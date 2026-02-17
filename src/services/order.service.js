const pool = require('../config/db');
const generateTracking = require('../utils/generateTracking');
const { calculatePrice } = require('./pricing.service');

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

    // Calculate price if zone info is provided
    let price = null;
    if (data.zone_id && data.distance_km) {
      const [zones] = await conn.execute('SELECT base_price, per_km_rate FROM zones WHERE id = ?', [data.zone_id]);
      if (zones.length > 0) {
        price = calculatePrice({
          zoneBasePrice: parseFloat(zones[0].base_price),
          perKmRate: parseFloat(zones[0].per_km_rate),
          distanceKm: data.distance_km,
        });
      }
    }

    // Insert order with placeholder tracking number
    const [result] = await conn.execute(
      `INSERT INTO orders (user_id, tracking_number, sender_name, sender_phone, pickup_address,
        receiver_name, receiver_phone, delivery_address, package_description,
        item_value, quantity, is_fragile, zone_id, distance_km, price, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Order Created')`,
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
        data.zone_id || null,
        data.distance_km || null,
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
    return { trackingNumber, price };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getOrderByTracking(trackingNumber) {
  const [orders] = await pool.execute(
    'SELECT tracking_number, sender_name, sender_phone, pickup_address, receiver_name, receiver_phone, delivery_address, package_description, item_value, quantity, is_fragile, price, status, created_at, updated_at FROM orders WHERE tracking_number = ?',
    [trackingNumber]
  );

  if (orders.length === 0) return null;

  const order = orders[0];

  const [events] = await pool.execute(
    'SELECT status, note, created_at FROM order_events WHERE order_id = (SELECT id FROM orders WHERE tracking_number = ?) ORDER BY created_at ASC',
    [trackingNumber]
  );

  return { ...order, events };
}

async function getAllOrders() {
  const [orders] = await pool.execute(
    'SELECT id, tracking_number, sender_name, receiver_name, pickup_address, delivery_address, package_description, item_value, quantity, is_fragile, price, status, created_at, updated_at FROM orders ORDER BY created_at DESC'
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
    'SELECT id, tracking_number, sender_name, receiver_name, pickup_address, delivery_address, package_description, item_value, quantity, is_fragile, price, status, created_at, updated_at FROM orders WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  return orders;
}

module.exports = { createOrder, getOrderByTracking, getAllOrders, updateOrderStatus, getOrdersByUserId };
