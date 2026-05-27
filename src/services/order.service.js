const pool = require('../config/db');
const generateTracking = require('../utils/generateTracking');
const { calculatePrice } = require('./pricing.service');
const regionPricing = require('./regionPricing.service');

const PENDING_PAYMENT_STATUS = 'Pending Payment';
const ORDER_CREATED_STATUS = 'Order Created';
const LOGISTICS_STATUSES = [
  ORDER_CREATED_STATUS,
  'Picked Up',
  'In Transit',
  'Out for Delivery',
  'Delivered',
];

function regionRateError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

async function resolveOrderPayload(data, userId, conn = pool) {
  const [verifyRows] = await conn.execute(
    'SELECT is_email_verified FROM customers WHERE id = ? LIMIT 1',
    [userId]
  );
  if (!verifyRows.length || !verifyRows[0].is_email_verified) {
    const err = new Error('EMAIL_NOT_VERIFIED');
    err.statusCode = 403;
    throw err;
  }

  let senderName = data.sender_name;
  let senderPhone = data.sender_phone;
  let pickupAddress = data.pickup_address;

  if (!senderName || !senderPhone || !pickupAddress) {
    const [customers] = await conn.execute(
      'SELECT name, phone, default_address FROM customers WHERE id = ?',
      [userId]
    );
    if (customers.length > 0) {
      const customer = customers[0];
      senderName = senderName || customer.name;
      senderPhone = senderPhone || customer.phone;
      pickupAddress = pickupAddress || customer.default_address;
    }
  }

  let price = null;
  let pickupRegionId = data.pickup_region_id ?? null;
  let deliveryRegionId = data.delivery_region_id ?? null;
  let deliveryRegionAreaId = data.delivery_region_area_id ?? null;
  let etaMinHours = null;
  let etaMaxHours = null;
  let etaLabel = null;
  let zoneId = data.zone_id ?? null;
  let distanceKm = data.distance_km ?? null;

  if (pickupRegionId != null && deliveryRegionId != null) {
    const rate = await regionPricing.getActiveRate(pickupRegionId, deliveryRegionId);
    if (!rate) {
      throw regionRateError('No active delivery rate for this pickup and delivery region');
    }
    price = Number(rate.price_ngn);
    etaMinHours = rate.eta_min_hours;
    etaMaxHours = rate.eta_max_hours;
    etaLabel = rate.eta_label || null;
    zoneId = null;
    distanceKm = null;
  } else if (zoneId != null && distanceKm != null) {
    const [zones] = await conn.execute('SELECT base_price, per_km_rate FROM zones WHERE id = ?', [zoneId]);
    if (zones.length > 0) {
      price = calculatePrice({
        zoneBasePrice: parseFloat(zones[0].base_price),
        perKmRate: parseFloat(zones[0].per_km_rate),
        distanceKm,
      });
    }
    pickupRegionId = null;
    deliveryRegionId = null;
    deliveryRegionAreaId = null;
  }

  return {
    senderName,
    senderPhone,
    pickupAddress,
    receiverName: data.receiver_name,
    receiverPhone: data.receiver_phone,
    deliveryAddress: data.delivery_address,
    packageDescription: data.package_description || null,
    itemValue: data.item_value || null,
    quantity: data.quantity || 1,
    isFragile: data.is_fragile || false,
    zoneId,
    distanceKm,
    pickupRegionId,
    deliveryRegionId,
    deliveryRegionAreaId,
    etaMinHours,
    etaMaxHours,
    etaLabel,
    price,
  };
}

async function insertResolvedOrder(conn, userId, resolved, link = {}) {
  const {
    initialStatus = ORDER_CREATED_STATUS,
    paymentIntentId = null,
    paystackReference = null,
    eventNote,
  } = link;

  const status = initialStatus;
  const note =
    eventNote ||
    (status === PENDING_PAYMENT_STATUS
      ? 'Awaiting payment confirmation.'
      : 'Order has been placed successfully.');

  const [result] = await conn.execute(
    `INSERT INTO orders (user_id, payment_intent_id, paystack_reference, tracking_number, sender_name, sender_phone, pickup_address,
      receiver_name, receiver_phone, delivery_address, package_description,
      item_value, quantity, is_fragile, zone_id, distance_km,
      pickup_region_id, delivery_region_id, delivery_region_area_id, eta_min_hours, eta_max_hours, eta_label,
      price, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      paymentIntentId,
      paystackReference,
      'TEMP',
      resolved.senderName,
      resolved.senderPhone,
      resolved.pickupAddress,
      resolved.receiverName,
      resolved.receiverPhone,
      resolved.deliveryAddress,
      resolved.packageDescription,
      resolved.itemValue,
      resolved.quantity,
      resolved.isFragile,
      resolved.zoneId,
      resolved.distanceKm,
      resolved.pickupRegionId,
      resolved.deliveryRegionId,
      resolved.deliveryRegionAreaId,
      resolved.etaMinHours,
      resolved.etaMaxHours,
      resolved.etaLabel,
      resolved.price,
      status,
    ]
  );

  const orderId = result.insertId;
  const trackingNumber = generateTracking(orderId);

  await conn.execute('UPDATE orders SET tracking_number = ? WHERE id = ?', [trackingNumber, orderId]);
  await conn.execute(
    'INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)',
    [orderId, status, note]
  );

  return {
    orderId,
    trackingNumber,
    price: Number(resolved.price),
    senderName: resolved.senderName,
    senderPhone: resolved.senderPhone,
    receiverName: resolved.receiverName,
  };
}

async function createOrder(data, userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const resolved = await resolveOrderPayload(data, userId, conn);
    const result = await insertResolvedOrder(conn, userId, resolved);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function createOrderFromSnapshot(userId, snapshot, conn = null, link = {}) {
  const runner = conn || await pool.getConnection();
  const ownsConnection = !conn;
  try {
    if (ownsConnection) {
      await runner.beginTransaction();
    }

    const result = await insertResolvedOrder(runner, userId, {
      senderName: snapshot.sender_name,
      senderPhone: snapshot.sender_phone,
      pickupAddress: snapshot.pickup_address,
      receiverName: snapshot.receiver_name,
      receiverPhone: snapshot.receiver_phone,
      deliveryAddress: snapshot.delivery_address,
      packageDescription: snapshot.package_description || null,
      itemValue: snapshot.item_value || null,
      quantity: snapshot.quantity || 1,
      isFragile: snapshot.is_fragile || false,
      zoneId: snapshot.zone_id ?? null,
      distanceKm: snapshot.distance_km ?? null,
      pickupRegionId: snapshot.pickup_region_id ?? null,
      deliveryRegionId: snapshot.delivery_region_id ?? null,
      deliveryRegionAreaId: snapshot.delivery_region_area_id ?? null,
      etaMinHours: snapshot.eta_min_hours ?? null,
      etaMaxHours: snapshot.eta_max_hours ?? null,
      etaLabel: snapshot.eta_label || null,
      price: Number(snapshot.price),
    }, link);

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

async function ordersExistForReference(paystackReference) {
  const [rows] = await pool.execute(
    'SELECT id FROM orders WHERE paystack_reference = ? LIMIT 1',
    [paystackReference]
  );
  return rows.length > 0;
}

async function confirmOrdersForPayment(conn, paystackReference) {
  const [rows] = await conn.execute(
    `SELECT id FROM orders WHERE paystack_reference = ? AND status = ?`,
    [paystackReference, PENDING_PAYMENT_STATUS]
  );

  for (const row of rows) {
    await conn.execute('UPDATE orders SET status = ? WHERE id = ?', [ORDER_CREATED_STATUS, row.id]);
    await conn.execute(
      'INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)',
      [row.id, ORDER_CREATED_STATUS, 'Payment confirmed. Order is ready for processing.']
    );
  }

  return rows.length;
}

const ORDER_REGION_JOINS = `
  LEFT JOIN pickup_regions pr ON pr.id = o.pickup_region_id
  LEFT JOIN delivery_regions dr ON dr.id = o.delivery_region_id
  LEFT JOIN delivery_region_areas dra ON dra.id = o.delivery_region_area_id`;

const ORDER_DETAIL_COLUMNS = `
  o.id, o.tracking_number, o.paystack_reference, o.sender_name, o.sender_phone, o.pickup_address,
  o.receiver_name, o.receiver_phone, o.delivery_address, o.package_description,
  o.item_value, o.quantity, o.is_fragile,
  o.pickup_region_id, o.delivery_region_id, o.delivery_region_area_id,
  o.eta_min_hours, o.eta_max_hours, o.eta_label,
  o.price, o.status, o.created_at, o.updated_at,
  pr.name AS pickup_region_name,
  dr.name AS delivery_region_name,
  dra.name AS delivery_region_area_name`;

function mapOrderEvents(eventRows) {
  return eventRows.map((r, i) => ({
    id: i + 1,
    status: r.status,
    description: r.note || '',
    created_at: r.created_at,
  }));
}

async function fetchOrderEvents(orderId) {
  const [eventRows] = await pool.execute(
    'SELECT status, note, created_at FROM order_events WHERE order_id = ? ORDER BY created_at ASC',
    [orderId]
  );
  return mapOrderEvents(eventRows);
}

async function getOrderByTracking(trackingNumber) {
  const [orders] = await pool.execute(
    `SELECT o.tracking_number, o.sender_name, o.sender_phone, o.pickup_address, o.receiver_name, o.receiver_phone,
            o.delivery_address, o.package_description, o.item_value, o.quantity, o.is_fragile,
            o.pickup_region_id, o.delivery_region_id, o.delivery_region_area_id,
            o.eta_min_hours, o.eta_max_hours, o.eta_label,
            o.price, o.status, o.created_at, o.updated_at,
            pr.name AS pickup_region_name,
            dr.name AS delivery_region_name,
            dra.name AS delivery_region_area_name
     FROM orders o
     ${ORDER_REGION_JOINS}
     WHERE o.tracking_number = ?`,
    [trackingNumber]
  );

  if (orders.length === 0) return null;

  const order = orders[0];

  const [idRows] = await pool.execute('SELECT id FROM orders WHERE tracking_number = ?', [trackingNumber]);
  const events = await fetchOrderEvents(idRows[0].id);

  return { ...order, events };
}

async function getOrderById(orderId) {
  const [orders] = await pool.execute(
    `SELECT ${ORDER_DETAIL_COLUMNS}
     FROM orders o
     ${ORDER_REGION_JOINS}
     WHERE o.id = ?`,
    [orderId]
  );

  if (orders.length === 0) return null;

  const order = orders[0];
  const events = await fetchOrderEvents(order.id);

  return { ...order, events };
}

async function getAllOrders() {
  const [orders] = await pool.execute(
    `SELECT id, tracking_number, paystack_reference, sender_name, receiver_name, pickup_address, delivery_address,
            package_description, item_value, quantity, is_fragile,
            pickup_region_id, delivery_region_id, delivery_region_area_id, eta_min_hours, eta_max_hours, eta_label,
            price, status, created_at, updated_at
     FROM orders ORDER BY created_at DESC`
  );
  return orders;
}

async function updateOrderStatus(orderId, status, note) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);

    await conn.execute(
      'INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)',
      [orderId, status, note || null]
    );

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getOrdersByUserId(userId) {
  const [orders] = await pool.execute(
    `SELECT id, tracking_number, sender_name, receiver_name, pickup_address, delivery_address,
            package_description, item_value, quantity, is_fragile,
            pickup_region_id, delivery_region_id, delivery_region_area_id, eta_min_hours, eta_max_hours, eta_label,
            price, status, created_at, updated_at
     FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  return orders;
}

module.exports = {
  PENDING_PAYMENT_STATUS,
  ORDER_CREATED_STATUS,
  LOGISTICS_STATUSES,
  createOrder,
  createOrderFromSnapshot,
  resolveOrderPayload,
  insertResolvedOrder,
  ordersExistForReference,
  confirmOrdersForPayment,
  getOrderByTracking,
  getOrderById,
  getAllOrders,
  updateOrderStatus,
  getOrdersByUserId,
};
