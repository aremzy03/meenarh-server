const pool = require('../config/db');
const generateTracking = require('../utils/generateTracking');
const { calculatePrice } = require('./pricing.service');
const regionPricing = require('./regionPricing.service');

function regionRateError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

async function createOrder(data, userId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Get user profile to populate sender info if not provided
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
      price = rate.price_ngn;
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
    }

    // Insert order with placeholder tracking number
    const [result] = await conn.execute(
      `INSERT INTO orders (user_id, tracking_number, sender_name, sender_phone, pickup_address,
        receiver_name, receiver_phone, delivery_address, package_description,
        item_value, quantity, is_fragile, zone_id, distance_km,
        pickup_region_id, delivery_region_id, eta_min_hours, eta_max_hours, eta_label,
        price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Order Created')`,
      [
        userId,
        'TEMP',
        senderName,
        senderPhone,
        pickupAddress,
        data.receiver_name,
        data.receiver_phone,
        data.delivery_address,
        data.package_description || null,
        data.item_value || null,
        data.quantity || 1,
        data.is_fragile || false,
        zoneId,
        distanceKm,
        pickupRegionId,
        deliveryRegionId,
        etaMinHours,
        etaMaxHours,
        etaLabel,
        price,
      ]
    );

    const orderId = result.insertId;
    const trackingNumber = generateTracking(orderId);

    // Update with real tracking number
    await conn.execute('UPDATE orders SET tracking_number = ? WHERE id = ?', [trackingNumber, orderId]);

    // Insert first event
    await conn.execute(
      'INSERT INTO order_events (order_id, status, note) VALUES (?, ?, ?)',
      [orderId, 'Order Created', 'Order has been placed successfully.']
    );

    await conn.commit();
    return {
      orderId,
      trackingNumber,
      price,
      senderName,
      senderPhone,
      receiverName: data.receiver_name,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getOrderByTracking(trackingNumber) {
  const [orders] = await pool.execute(
    `SELECT tracking_number, sender_name, sender_phone, pickup_address, receiver_name, receiver_phone,
            delivery_address, package_description, item_value, quantity, is_fragile,
            pickup_region_id, delivery_region_id, eta_min_hours, eta_max_hours, eta_label,
            price, status, created_at, updated_at
     FROM orders WHERE tracking_number = ?`,
    [trackingNumber]
  );

  if (orders.length === 0) return null;

  const order = orders[0];

  const [eventRows] = await pool.execute(
    'SELECT status, note, created_at FROM order_events WHERE order_id = (SELECT id FROM orders WHERE tracking_number = ?) ORDER BY created_at ASC',
    [trackingNumber]
  );

  const events = eventRows.map((r, i) => ({
    id: i + 1,
    status: r.status,
    description: r.note || '',
    created_at: r.created_at,
  }));

  return { ...order, events };
}

async function getAllOrders() {
  const [orders] = await pool.execute(
    `SELECT id, tracking_number, sender_name, receiver_name, pickup_address, delivery_address,
            package_description, item_value, quantity, is_fragile,
            pickup_region_id, delivery_region_id, eta_min_hours, eta_max_hours, eta_label,
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
            pickup_region_id, delivery_region_id, eta_min_hours, eta_max_hours, eta_label,
            price, status, created_at, updated_at
     FROM orders WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  return orders;
}

module.exports = { createOrder, getOrderByTracking, getAllOrders, updateOrderStatus, getOrdersByUserId };
