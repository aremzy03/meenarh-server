const pool = require('../config/db');
const pricingService = require('./pricing.service');
const orderService = require('./order.service');
const regionPricing = require('./regionPricing.service');
const bulkOrderService = require('./bulkOrder.service');

function regionRateError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

async function resolveLinePricing(itemData) {
  const pickupRegionId = itemData.pickup_region_id ?? null;
  const deliveryRegionId = itemData.delivery_region_id ?? null;
  const zoneId = itemData.zone_id ?? null;
  const distanceKm = itemData.distance_km ?? null;

  if (pickupRegionId != null && deliveryRegionId != null) {
    const rate = await regionPricing.getActiveRate(pickupRegionId, deliveryRegionId);
    if (!rate) {
      throw regionRateError('No active delivery rate for this pickup and delivery region');
    }
    return {
      estimated_price: rate.price_ngn,
      pickup_region_id: pickupRegionId,
      delivery_region_id: deliveryRegionId,
      eta_min_hours: rate.eta_min_hours,
      eta_max_hours: rate.eta_max_hours,
      eta_label: rate.eta_label || null,
      zone_id: null,
      distance_km: null,
    };
  }

  const estimated_price = await pricingService.calculatePriceFromZone(zoneId, distanceKm);
  return {
    estimated_price,
    pickup_region_id: null,
    delivery_region_id: null,
    eta_min_hours: null,
    eta_max_hours: null,
    eta_label: null,
    zone_id: zoneId || null,
    distance_km: distanceKm || null,
  };
}

// Add item to cart
async function addToCart(itemData, userId) {
  const {
    sender_name,
    sender_phone,
    pickup_address,
    receiver_name,
    receiver_phone,
    delivery_address,
    package_description,
    item_value,
    quantity = 1,
    is_fragile = false,
    delivery_region_area_id,
  } = itemData;

  const pricing = await resolveLinePricing(itemData);

  const [result] = await pool.execute(
    `INSERT INTO cart_items (
      user_id, sender_name, sender_phone, pickup_address,
      receiver_name, receiver_phone, delivery_address,
      package_description, item_value, quantity, is_fragile,
      zone_id, distance_km,
      pickup_region_id, delivery_region_id, delivery_region_area_id, eta_min_hours, eta_max_hours, eta_label,
      estimated_price
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      sender_name || null,
      sender_phone || null,
      pickup_address || null,
      receiver_name,
      receiver_phone,
      delivery_address,
      package_description || null,
      item_value || null,
      quantity,
      is_fragile,
      pricing.zone_id,
      pricing.distance_km,
      pricing.pickup_region_id,
      pricing.delivery_region_id,
      delivery_region_area_id ?? null,
      pricing.eta_min_hours,
      pricing.eta_max_hours,
      pricing.eta_label,
      pricing.estimated_price,
    ]
  );

  return { id: result.insertId, estimated_price: pricing.estimated_price };
}

function toNumberOrNull(value) {
  return value == null ? null : Number(value);
}

function normalizeSingleCartRow(row) {
  return {
    ...row,
    kind: 'single',
    cart_key: `single:${row.id}`,
    item_value: toNumberOrNull(row.item_value),
    quantity: row.quantity == null ? 1 : Number(row.quantity),
    distance_km: toNumberOrNull(row.distance_km),
    estimated_price: toNumberOrNull(row.estimated_price),
  };
}

function normalizeBulkCartItem(row) {
  return {
    ...row,
    item_value: toNumberOrNull(row.item_value),
    quantity: row.quantity == null ? 1 : Number(row.quantity),
    estimated_price: toNumberOrNull(row.estimated_price),
  };
}

function normalizeBulkCartEntry(row, items) {
  return {
    ...row,
    kind: 'bulk',
    cart_key: `bulk:${row.id}`,
    estimated_price: toNumberOrNull(row.estimated_total),
    estimated_total: toNumberOrNull(row.estimated_total),
    item_count: row.item_count == null ? items.length : Number(row.item_count),
    items,
  };
}

async function getSingleCartItems(userId, conn = pool) {
  const [rows] = await conn.execute(
    `SELECT * FROM cart_items WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  return rows.map(normalizeSingleCartRow);
}

async function getBulkCartEntries(userId, conn = pool) {
  const [entries] = await conn.execute(
    `SELECT * FROM cart_bulk_entries WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );

  if (!entries.length) {
    return [];
  }

  const placeholders = entries.map(() => '?').join(', ');
  const [itemRows] = await conn.execute(
    `SELECT * FROM cart_bulk_entry_items
     WHERE cart_bulk_entry_id IN (${placeholders})
     ORDER BY cart_bulk_entry_id DESC, sort_index ASC`,
    entries.map((entry) => entry.id)
  );

  const itemsByEntryId = new Map();
  for (const row of itemRows) {
    const list = itemsByEntryId.get(row.cart_bulk_entry_id) || [];
    list.push(normalizeBulkCartItem(row));
    itemsByEntryId.set(row.cart_bulk_entry_id, list);
  }

  return entries.map((entry) => normalizeBulkCartEntry(entry, itemsByEntryId.get(entry.id) || []));
}

async function getCartItems(userId) {
  const [singleItems, bulkEntries] = await Promise.all([
    getSingleCartItems(userId),
    getBulkCartEntries(userId),
  ]);

  return [...singleItems, ...bulkEntries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

// Update cart item
async function updateCartItem(itemId, itemData, userId) {
  const {
    sender_name,
    sender_phone,
    pickup_address,
    receiver_name,
    receiver_phone,
    delivery_address,
    package_description,
    item_value,
    quantity,
    is_fragile,
    delivery_region_area_id,
  } = itemData;

  const pricing = await resolveLinePricing(itemData);

  await pool.execute(
    `UPDATE cart_items SET
      sender_name = ?,
      sender_phone = ?,
      pickup_address = ?,
      receiver_name = ?,
      receiver_phone = ?,
      delivery_address = ?,
      package_description = ?,
      item_value = ?,
      quantity = ?,
      is_fragile = ?,
      zone_id = ?,
      distance_km = ?,
      pickup_region_id = ?,
      delivery_region_id = ?,
      delivery_region_area_id = ?,
      eta_min_hours = ?,
      eta_max_hours = ?,
      eta_label = ?,
      estimated_price = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND user_id = ?`,
    [
      sender_name || null,
      sender_phone || null,
      pickup_address || null,
      receiver_name,
      receiver_phone,
      delivery_address,
      package_description || null,
      item_value || null,
      quantity || 1,
      is_fragile || false,
      pricing.zone_id,
      pricing.distance_km,
      pricing.pickup_region_id,
      pricing.delivery_region_id,
      delivery_region_area_id ?? null,
      pricing.eta_min_hours,
      pricing.eta_max_hours,
      pricing.eta_label,
      pricing.estimated_price,
      itemId,
      userId,
    ]
  );

  return { estimated_price: pricing.estimated_price };
}

async function insertBulkDraftItems(conn, cartBulkEntryId, defaultPickup, resolvedItems) {
  for (const item of resolvedItems) {
    await conn.execute(
      `INSERT INTO cart_bulk_entry_items (
        cart_bulk_entry_id, sort_index, pickup_region_id, pickup_address,
        delivery_region_id, delivery_region_area_id, delivery_address,
        receiver_name, receiver_phone, package_description, item_value, quantity, is_fragile,
        estimated_price, eta_min_hours, eta_max_hours, eta_label
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cartBulkEntryId,
        item.sortIndex,
        item.pickup_region_id,
        item.pickup_address || defaultPickup || null,
        item.delivery_region_id,
        item.delivery_region_area_id || null,
        item.delivery_address,
        item.receiver_name,
        item.receiver_phone,
        item.package_description || null,
        item.item_value || null,
        item.quantity || 1,
        item.is_fragile || false,
        Number(item.rate.price_ngn),
        item.rate.eta_min_hours,
        item.rate.eta_max_hours,
        item.rate.eta_label || null,
      ]
    );
  }
}

async function addBulkToCart(data, userId) {
  const resolved = await bulkOrderService.resolveBulkOrderPayload(data, userId);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      `INSERT INTO cart_bulk_entries (
        user_id, sender_name, sender_phone, pickup_address, estimated_total, item_count
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        resolved.senderName,
        resolved.senderPhone,
        resolved.defaultPickup,
        Number(resolved.totalPrice),
        resolved.resolvedItems.length,
      ]
    );

    await insertBulkDraftItems(
      conn,
      result.insertId,
      resolved.defaultPickup,
      resolved.resolvedItems
    );

    await conn.commit();
    return { id: result.insertId, estimated_price: Number(resolved.totalPrice) };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function updateBulkCartEntry(entryId, data, userId) {
  const resolved = await bulkOrderService.resolveBulkOrderPayload(data, userId);
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();
    const [entries] = await conn.execute(
      'SELECT id FROM cart_bulk_entries WHERE id = ? AND user_id = ? LIMIT 1',
      [entryId, userId]
    );

    if (!entries.length) {
      const err = new Error('Bulk cart entry not found');
      err.statusCode = 404;
      throw err;
    }

    await conn.execute(
      `UPDATE cart_bulk_entries
       SET sender_name = ?, sender_phone = ?, pickup_address = ?, estimated_total = ?, item_count = ?
       WHERE id = ? AND user_id = ?`,
      [
        resolved.senderName,
        resolved.senderPhone,
        resolved.defaultPickup,
        Number(resolved.totalPrice),
        resolved.resolvedItems.length,
        entryId,
        userId,
      ]
    );

    await conn.execute('DELETE FROM cart_bulk_entry_items WHERE cart_bulk_entry_id = ?', [entryId]);
    await insertBulkDraftItems(conn, entryId, resolved.defaultPickup, resolved.resolvedItems);

    await conn.commit();
    return { estimated_price: Number(resolved.totalPrice) };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

// Delete cart item
async function removeCartItem(itemId, userId) {
  const [result] = await pool.execute(
    `DELETE FROM cart_items WHERE id = ? AND user_id = ?`,
    [itemId, userId]
  );

  return result.affectedRows > 0;
}

async function removeBulkCartEntry(entryId, userId) {
  const [result] = await pool.execute(
    'DELETE FROM cart_bulk_entries WHERE id = ? AND user_id = ?',
    [entryId, userId]
  );

  return result.affectedRows > 0;
}

// Clear all cart items
async function clearCart(userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('DELETE FROM cart_items WHERE user_id = ?', [userId]);
    await conn.execute('DELETE FROM cart_bulk_entries WHERE user_id = ?', [userId]);
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
  return true;
}

function buildSingleSnapshot(item) {
  return {
    cart_item_id: item.id,
    sender_name: item.sender_name,
    sender_phone: item.sender_phone,
    pickup_address: item.pickup_address,
    receiver_name: item.receiver_name,
    receiver_phone: item.receiver_phone,
    delivery_address: item.delivery_address,
    package_description: item.package_description,
    item_value: item.item_value,
    quantity: item.quantity || 1,
    is_fragile: item.is_fragile || false,
    zone_id: item.zone_id,
    distance_km: item.distance_km,
    pickup_region_id: item.pickup_region_id,
    delivery_region_id: item.delivery_region_id,
    delivery_region_area_id: item.delivery_region_area_id,
    eta_min_hours: item.eta_min_hours,
    eta_max_hours: item.eta_max_hours,
    eta_label: item.eta_label,
    price: Number(item.estimated_price || 0),
  };
}

function buildBulkSnapshot(entry) {
  return {
    cart_bulk_entry_id: entry.id,
    senderName: entry.sender_name,
    senderPhone: entry.sender_phone,
    defaultPickup: entry.pickup_address,
    amount_ngn: Number(entry.estimated_total || 0),
    resolvedItems: entry.items.map((item, index) => ({
      pickup_region_id: item.pickup_region_id,
      pickup_address: item.pickup_address,
      delivery_region_id: item.delivery_region_id,
      delivery_region_area_id: item.delivery_region_area_id,
      delivery_address: item.delivery_address,
      receiver_name: item.receiver_name,
      receiver_phone: item.receiver_phone,
      package_description: item.package_description,
      item_value: item.item_value,
      quantity: item.quantity || 1,
      is_fragile: item.is_fragile || false,
      sortIndex: item.sort_index ?? index,
      rate: {
        price_ngn: Number(item.estimated_price || 0),
        eta_min_hours: item.eta_min_hours,
        eta_max_hours: item.eta_max_hours,
        eta_label: item.eta_label,
      },
    })),
  };
}

async function getBulkCheckoutSnapshot(entryId, userId, conn = pool) {
  const bulkEntries = await getBulkCartEntries(userId, conn);
  const entry = bulkEntries.find((bulkEntry) => Number(bulkEntry.id) === Number(entryId));

  if (!entry) {
    const err = new Error('Bulk cart entry not found');
    err.statusCode = 404;
    throw err;
  }

  if (!entry.items.length) {
    const err = new Error('Bulk cart entry has no items');
    err.statusCode = 400;
    throw err;
  }

  return buildBulkSnapshot(entry);
}

async function getCheckoutSnapshot(userId, conn = pool) {
  const [singleItems, bulkEntries] = await Promise.all([
    getSingleCartItems(userId, conn),
    getBulkCartEntries(userId, conn),
  ]);

  const snapshot = {
    singleItems: singleItems.map(buildSingleSnapshot),
    bulkEntries: bulkEntries.map(buildBulkSnapshot),
  };

  snapshot.subtotal =
    snapshot.singleItems.reduce((sum, item) => sum + Number(item.price || 0), 0) +
    snapshot.bulkEntries.reduce((sum, entry) => sum + Number(entry.amount_ngn || 0), 0);
  snapshot.totalDeliveries =
    snapshot.singleItems.length +
    snapshot.bulkEntries.reduce((sum, entry) => sum + entry.resolvedItems.length, 0);

  return snapshot;
}

async function clearDraftsInConnection(conn, userId, { singleItemIds = [], bulkEntryIds = [] }) {
  if (singleItemIds.length) {
    const placeholders = singleItemIds.map(() => '?').join(', ');
    await conn.execute(
      `DELETE FROM cart_items WHERE user_id = ? AND id IN (${placeholders})`,
      [userId, ...singleItemIds]
    );
  }

  if (bulkEntryIds.length) {
    const placeholders = bulkEntryIds.map(() => '?').join(', ');
    await conn.execute(
      `DELETE FROM cart_bulk_entries WHERE user_id = ? AND id IN (${placeholders})`,
      [userId, ...bulkEntryIds]
    );
  }
}

async function fulfillCheckoutSnapshot(conn, userId, snapshot) {
  const entries = [];

  for (const item of snapshot.singleItems) {
    const result = await orderService.createOrderFromSnapshot(userId, item, conn);
    entries.push({
      kind: 'single',
      trackingNumber: result.trackingNumber,
      price: Number(result.price || 0),
    });
  }

  for (const entry of snapshot.bulkEntries) {
    const result = await bulkOrderService.createBulkOrderFromSnapshot(userId, entry, conn);
    entries.push({
      kind: 'bulk',
      trackingNumber: result.trackingNumber,
      price: Number(result.totalPrice || 0),
      bulkItemCount: result.itemCount,
    });
  }

  await clearDraftsInConnection(conn, userId, {
    singleItemIds: snapshot.singleItems.map((item) => item.cart_item_id),
    bulkEntryIds: snapshot.bulkEntries.map((entry) => entry.cart_bulk_entry_id),
  });

  return {
    entries,
    hasSingle: snapshot.singleItems.length > 0,
    hasBulk: snapshot.bulkEntries.length > 0,
    totalDeliveries: snapshot.totalDeliveries,
    totalPrice: entries.reduce((sum, entry) => sum + Number(entry.price || 0), 0),
  };
}

// Checkout - convert mixed cart entries to orders / bulk orders
async function checkout(userId) {
  const snapshot = await getCheckoutSnapshot(userId);
  const hasEntries = snapshot.singleItems.length > 0 || snapshot.bulkEntries.length > 0;
  if (!hasEntries) {
    const err = new Error('Cart is empty');
    err.statusCode = 400;
    throw err;
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await fulfillCheckoutSnapshot(connection, userId, snapshot);
    await connection.commit();
    return result.entries;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// Checkout single item - convert one cart item to order
async function checkoutSingleItem(itemId, userId) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const singleItems = await getSingleCartItems(userId, connection);
    const item = singleItems.find((cartItem) => Number(cartItem.id) === Number(itemId));

    if (!item) {
      const err = new Error('Cart item not found');
      err.statusCode = 404;
      throw err;
    }

    const result = await orderService.createOrderFromSnapshot(userId, buildSingleSnapshot(item), connection);
    await clearDraftsInConnection(connection, userId, {
      singleItemIds: [Number(itemId)],
    });

    await connection.commit();

    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  addToCart,
  addBulkToCart,
  getCartItems,
  getSingleCartItems,
  getBulkCartEntries,
  getBulkCheckoutSnapshot,
  getCheckoutSnapshot,
  fulfillCheckoutSnapshot,
  clearDraftsInConnection,
  updateCartItem,
  updateBulkCartEntry,
  removeCartItem,
  removeBulkCartEntry,
  clearCart,
  checkout,
  checkoutSingleItem,
};
