const pool = require('../config/db');
const generateBulkTracking = require('../utils/generateBulkTracking');
const regionPricing = require('./regionPricing.service');

const ITEM_STATUSES = ['Pending', 'Picked Up', 'In Transit', 'Out for Delivery', 'Delivered'];

// Strict linear progression; each status can only move to the next
const ALLOWED_NEXT = {
  'Pending':           'Picked Up',
  'Picked Up':         'In Transit',
  'In Transit':        'Out for Delivery',
  'Out for Delivery':  'Delivered',
  'Delivered':         null,
};

function regionRateError(message, path) {
  const err = new Error(message);
  err.statusCode = 400;
  err.path = path;
  return err;
}

/**
 * Resolve sender defaults, verify email, and price every line.
 * Returns the data needed to insert the bulk order — does NOT write to DB.
 *
 * @param {object} data  Raw request body (sender_name, sender_phone, pickup_address, items[])
 * @param {number} userId
 * @returns {{ senderName, senderPhone, defaultPickup, resolvedItems, totalPrice }}
 */
async function resolveBulkOrderPayload(data, userId) {
  // Email verification gate
  const [verifyRows] = await pool.execute(
    'SELECT is_email_verified FROM customers WHERE id = ? LIMIT 1',
    [userId]
  );
  if (!verifyRows.length || !verifyRows[0].is_email_verified) {
    const err = new Error('EMAIL_NOT_VERIFIED');
    err.statusCode = 403;
    throw err;
  }

  // Sender / pickup defaults from profile
  let senderName    = data.sender_name;
  let senderPhone   = data.sender_phone;
  let defaultPickup = data.pickup_address;

  if (!senderName || !senderPhone || !defaultPickup) {
    const [customers] = await pool.execute(
      'SELECT name, phone, default_address FROM customers WHERE id = ?',
      [userId]
    );
    if (customers.length > 0) {
      const c = customers[0];
      senderName    = senderName    || c.name;
      senderPhone   = senderPhone   || c.phone;
      defaultPickup = defaultPickup || c.default_address;
    }
  }

  // Resolve rate per item and accumulate total price
  const resolvedItems = [];
  let totalPrice = 0;

  for (let i = 0; i < data.items.length; i++) {
    const item = data.items[i];
    const rate = await regionPricing.getActiveRate(item.pickup_region_id, item.delivery_region_id);

    if (!rate) {
      throw regionRateError(
        `No active delivery rate for item ${i + 1} (pickup_region_id: ${item.pickup_region_id}, delivery_region_id: ${item.delivery_region_id})`,
        `items[${i}]`
      );
    }

    totalPrice += rate.price_ngn;
    resolvedItems.push({ ...item, sortIndex: i, rate });
  }

  return { senderName, senderPhone, defaultPickup, resolvedItems, totalPrice };
}

/**
 * Insert a bulk order parent + items + events inside an existing transaction connection.
 * Does NOT commit or rollback.
 *
 * @param {object} conn            Active MySQL connection (with open transaction)
 * @param {number} userId
 * @param {string} senderName
 * @param {string} senderPhone
 * @param {string} defaultPickup   Default pickup address (used when item.pickup_address is absent)
 * @param {Array}  resolvedItems   Each entry: { ...item fields, sortIndex, rate: { price_ngn, eta_* } }
 * @returns {{ bulkOrderId, trackingNumber, totalPrice, itemCount, senderName }}
 */
async function insertBulkOrderWithResolvedItems(conn, userId, senderName, senderPhone, defaultPickup, resolvedItems) {
  const totalPrice = resolvedItems.reduce((sum, item) => sum + Number(item.rate.price_ngn), 0);

  // Insert parent row with placeholder tracking
  const [bulkResult] = await conn.execute(
    `INSERT INTO bulk_orders (user_id, tracking_number, sender_name, sender_phone, pickup_address, price, status)
     VALUES (?, 'TEMP', ?, ?, ?, ?, 'Order Created')`,
    [userId, senderName, senderPhone, defaultPickup, totalPrice]
  );
  const bulkOrderId = bulkResult.insertId;
  const trackingNumber = generateBulkTracking(bulkOrderId);

  await conn.execute(
    'UPDATE bulk_orders SET tracking_number = ? WHERE id = ?',
    [trackingNumber, bulkOrderId]
  );

  // Insert items
  for (const item of resolvedItems) {
    const effectivePickupAddress = item.pickup_address || defaultPickup;

    const [itemResult] = await conn.execute(
      `INSERT INTO bulk_order_items
         (bulk_order_id, sort_index,
          pickup_region_id, pickup_address,
          delivery_region_id, delivery_region_area_id, delivery_address,
          receiver_name, receiver_phone,
          package_description, item_value, quantity, is_fragile,
          price_ngn, eta_min_hours, eta_max_hours, eta_label,
          status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [
        bulkOrderId,
        item.sortIndex,
        item.pickup_region_id,
        effectivePickupAddress,
        item.delivery_region_id,
        item.delivery_region_area_id || null,
        item.delivery_address,
        item.receiver_name,
        item.receiver_phone,
        item.package_description || null,
        item.item_value || null,
        item.quantity || 1,
        item.is_fragile || false,
        item.rate.price_ngn,
        item.rate.eta_min_hours,
        item.rate.eta_max_hours,
        item.rate.eta_label || null,
      ]
    );

    await conn.execute(
      'INSERT INTO bulk_order_item_events (bulk_order_item_id, status, note) VALUES (?, ?, ?)',
      [itemResult.insertId, 'Pending', 'Item added to bulk order.']
    );
  }

  // Parent event
  await conn.execute(
    'INSERT INTO bulk_order_events (bulk_order_id, status, note) VALUES (?, ?, ?)',
    [bulkOrderId, 'Order Created', 'Bulk order has been placed successfully.']
  );

  return {
    bulkOrderId,
    trackingNumber,
    totalPrice,
    itemCount: resolvedItems.length,
    senderName,
  };
}

/**
 * Create a bulk order from a payment-intent snapshot (no fresh getActiveRate calls).
 * Used by fulfillIntentByReference after Paystack confirms payment.
 *
 * @param {number} userId
 * @param {object} snapshot  metadata stored at initialize time:
 *   { senderName, senderPhone, defaultPickup, resolvedItems, amount_ngn }
 * @returns {{ bulkOrderId, trackingNumber, totalPrice, itemCount, senderName }}
 */
async function createBulkOrderFromSnapshot(userId, snapshot, conn = null) {
  const { senderName, senderPhone, defaultPickup, resolvedItems, amount_ngn } = snapshot;

  // Sanity: total in snapshot must match what we stored (defence against corrupt metadata)
  const snapshotTotal = resolvedItems.reduce((sum, item) => sum + Number(item.rate.price_ngn), 0);
  if (Math.abs(snapshotTotal - Number(amount_ngn)) > 0.01) {
    const err = new Error('Bulk snapshot total does not match charged amount');
    err.statusCode = 500;
    throw err;
  }

  const runner = conn || await pool.getConnection();
  const ownsConnection = !conn;
  try {
    if (ownsConnection) {
      await runner.beginTransaction();
    }
    const result = await insertBulkOrderWithResolvedItems(
      runner, userId, senderName, senderPhone, defaultPickup, resolvedItems
    );
    if (ownsConnection) {
      await runner.commit();
    }
    return result;
  } catch (err) {
    if (ownsConnection) {
      await runner.rollback();
    }
    throw err;
  } finally {
    if (ownsConnection) {
      runner.release();
    }
  }
}

/**
 * Send WhatsApp + email notifications for a placed bulk order.
 * Non-blocking: caller should catch and log but never let failures surface to the user.
 *
 * @param {number} userId
 * @param {{ trackingNumber: string, totalPrice: number }} orderInfo
 */
async function notifyBulkOrderPlaced(userId, { trackingNumber, totalPrice }) {
  try {
    const { sendTemplateMessage } = require('./whatsapp.service');
    const { sendOrderConfirmationEmail } = require('./email.service');

    const [customers] = await pool.execute(
      'SELECT email, phone, name FROM customers WHERE id = ?',
      [userId]
    );
    const customer = customers[0];

    if (customer?.phone) {
      sendTemplateMessage({
        to: customer.phone,
        templateName: 'order_confirmation',
        languageCode: 'en',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: customer.name || 'there' },
              { type: 'text', text: trackingNumber },
              { type: 'text', text: String(totalPrice ?? '') },
            ],
          },
        ],
      });
    }

    if (customer?.email) {
      sendOrderConfirmationEmail({
        to: customer.email,
        name: customer.name,
        trackingNumber,
        price: totalPrice,
        orderId: trackingNumber,
      });
    }
  } catch (notifyErr) {
    // eslint-disable-next-line no-console
    console.error('[bulkOrder.service] Failed to send bulk order notifications', notifyErr);
  }
}

/**
 * Create a bulk order:
 *  - Verify customer email
 *  - Fill sender / default pickup from profile when omitted
 *  - Resolve getActiveRate for every item; abort (400) on any missing rate
 *  - Sum line prices → bulk total
 *  - Insert parent + items + events in a single transaction
 */
async function createBulkOrder(data, userId) {
  const resolved = await resolveBulkOrderPayload(data, userId);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await insertBulkOrderWithResolvedItems(
      conn,
      userId,
      resolved.senderName,
      resolved.senderPhone,
      resolved.defaultPickup,
      resolved.resolvedItems
    );
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

/**
 * Get a bulk order by tracking number (for the /track endpoint).
 * Returns parent + items (each with their events) + parent events.
 */
async function getBulkOrderByTracking(trackingNumber) {
  const [bulks] = await pool.execute(
    `SELECT b.id, b.tracking_number, b.sender_name, b.sender_phone, b.pickup_address,
            b.price, b.status, b.created_at, b.updated_at
     FROM bulk_orders b
     WHERE b.tracking_number = ?`,
    [trackingNumber]
  );
  if (bulks.length === 0) return null;

  const bulk = bulks[0];
  const [items] = await pool.execute(
    `SELECT i.id, i.sort_index, i.pickup_region_id, i.pickup_address,
            i.delivery_region_id, i.delivery_region_area_id, i.delivery_address,
            i.receiver_name, i.receiver_phone,
            i.package_description, i.item_value, i.quantity, i.is_fragile,
            i.price_ngn, i.eta_min_hours, i.eta_max_hours, i.eta_label,
            i.status, i.created_at, i.updated_at
     FROM bulk_order_items i
     WHERE i.bulk_order_id = ?
     ORDER BY i.sort_index ASC`,
    [bulk.id]
  );

  const [parentEvents] = await pool.execute(
    'SELECT status, note, created_at FROM bulk_order_events WHERE bulk_order_id = ? ORDER BY created_at ASC',
    [bulk.id]
  );

  const itemsWithEvents = await Promise.all(
    items.map(async (item) => {
      const [evts] = await pool.execute(
        'SELECT status, note, created_at FROM bulk_order_item_events WHERE bulk_order_item_id = ? ORDER BY created_at ASC',
        [item.id]
      );
      return {
        ...item,
        events: evts.map((e, idx) => ({ id: idx + 1, status: e.status, description: e.note || '', created_at: e.created_at })),
      };
    })
  );

  return {
    ...bulk,
    type: 'bulk',
    events: parentEvents.map((e, idx) => ({ id: idx + 1, status: e.status, description: e.note || '', created_at: e.created_at })),
    items: itemsWithEvents,
  };
}

/**
 * Get all bulk orders belonging to a user (list view, no item events).
 */
async function getBulkOrdersByUserId(userId) {
  const [bulks] = await pool.execute(
    `SELECT b.id, b.tracking_number, b.sender_name, b.pickup_address,
            b.price, b.status, b.created_at, b.updated_at,
            COUNT(i.id) AS item_count
     FROM bulk_orders b
     LEFT JOIN bulk_order_items i ON i.bulk_order_id = b.id
     WHERE b.user_id = ?
     GROUP BY b.id
     ORDER BY b.created_at DESC`,
    [userId]
  );
  return bulks;
}

/**
 * Get all bulk orders (admin list, no item events).
 */
async function getAllBulkOrders() {
  const [bulks] = await pool.execute(
    `SELECT b.id, b.tracking_number, b.sender_name, b.sender_phone, b.pickup_address,
            b.price, b.status, b.created_at, b.updated_at,
            COUNT(i.id) AS item_count,
            c.name AS customer_name, c.email AS customer_email
     FROM bulk_orders b
     LEFT JOIN bulk_order_items i ON i.bulk_order_id = b.id
     LEFT JOIN customers c ON c.id = b.user_id
     GROUP BY b.id
     ORDER BY b.created_at DESC`
  );
  return bulks;
}

/**
 * Get single bulk order with all items + events (admin detail / track).
 */
async function getBulkOrderById(bulkOrderId) {
  const [bulks] = await pool.execute(
    `SELECT b.id, b.tracking_number, b.sender_name, b.sender_phone, b.pickup_address,
            b.price, b.status, b.created_at, b.updated_at,
            c.name AS customer_name, c.email AS customer_email
     FROM bulk_orders b
     LEFT JOIN customers c ON c.id = b.user_id
     WHERE b.id = ?`,
    [bulkOrderId]
  );
  if (bulks.length === 0) return null;

  const bulk = bulks[0];
  const [items] = await pool.execute(
    `SELECT i.id, i.sort_index, i.pickup_region_id, i.pickup_address,
            i.delivery_region_id, i.delivery_region_area_id, i.delivery_address,
            i.receiver_name, i.receiver_phone,
            i.package_description, i.item_value, i.quantity, i.is_fragile,
            i.price_ngn, i.eta_min_hours, i.eta_max_hours, i.eta_label,
            i.status, i.created_at, i.updated_at
     FROM bulk_order_items i
     WHERE i.bulk_order_id = ?
     ORDER BY i.sort_index ASC`,
    [bulk.id]
  );

  const [parentEvents] = await pool.execute(
    'SELECT status, note, created_at FROM bulk_order_events WHERE bulk_order_id = ? ORDER BY created_at ASC',
    [bulk.id]
  );

  const itemsWithEvents = await Promise.all(
    items.map(async (item) => {
      const [evts] = await pool.execute(
        'SELECT status, note, created_at FROM bulk_order_item_events WHERE bulk_order_item_id = ? ORDER BY created_at ASC',
        [item.id]
      );
      return {
        ...item,
        events: evts.map((e, idx) => ({ id: idx + 1, status: e.status, description: e.note || '', created_at: e.created_at })),
      };
    })
  );

  return {
    ...bulk,
    type: 'bulk',
    events: parentEvents.map((e, idx) => ({ id: idx + 1, status: e.status, description: e.note || '', created_at: e.created_at })),
    items: itemsWithEvents,
  };
}

/**
 * Update the status of a single bulk order item.
 * Enforces the linear progression: Pending → Picked Up → In Transit → Out for Delivery → Delivered.
 */
async function updateBulkItemStatus(bulkOrderId, itemId, newStatus, note) {
  if (!ITEM_STATUSES.includes(newStatus)) {
    const err = new Error(`Invalid status. Allowed: ${ITEM_STATUSES.join(', ')}`);
    err.statusCode = 400;
    throw err;
  }

  const [items] = await pool.execute(
    'SELECT id, status FROM bulk_order_items WHERE id = ? AND bulk_order_id = ?',
    [itemId, bulkOrderId]
  );
  if (items.length === 0) {
    const err = new Error('Item not found in this bulk order');
    err.statusCode = 404;
    throw err;
  }

  const current = items[0].status;
  const expectedNext = ALLOWED_NEXT[current];

  if (expectedNext === null) {
    const err = new Error('This item has already been delivered');
    err.statusCode = 400;
    throw err;
  }

  if (newStatus !== expectedNext) {
    const err = new Error(`Cannot transition from "${current}" to "${newStatus}". Expected next status: "${expectedNext}"`);
    err.statusCode = 400;
    throw err;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      'UPDATE bulk_order_items SET status = ? WHERE id = ?',
      [newStatus, itemId]
    );

    await conn.execute(
      'INSERT INTO bulk_order_item_events (bulk_order_item_id, status, note) VALUES (?, ?, ?)',
      [itemId, newStatus, note || null]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  resolveBulkOrderPayload,
  insertBulkOrderWithResolvedItems,
  createBulkOrderFromSnapshot,
  notifyBulkOrderPlaced,
  createBulkOrder,
  getBulkOrderByTracking,
  getBulkOrdersByUserId,
  getAllBulkOrders,
  getBulkOrderById,
  updateBulkItemStatus,
};
