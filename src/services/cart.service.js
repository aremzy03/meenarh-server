const pool = require('../config/db');
const pricingService = require('./pricing.service');
const orderService = require('./order.service');
const regionPricing = require('./regionPricing.service');

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
  } = itemData;

  const pricing = await resolveLinePricing(itemData);

  const [result] = await pool.execute(
    `INSERT INTO cart_items (
      user_id, sender_name, sender_phone, pickup_address,
      receiver_name, receiver_phone, delivery_address,
      package_description, item_value, quantity, is_fragile,
      zone_id, distance_km,
      pickup_region_id, delivery_region_id, eta_min_hours, eta_max_hours, eta_label,
      estimated_price
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      pricing.eta_min_hours,
      pricing.eta_max_hours,
      pricing.eta_label,
      pricing.estimated_price,
    ]
  );

  return { id: result.insertId, estimated_price: pricing.estimated_price };
}

// Get user's cart items
async function getCartItems(userId) {
  const [rows] = await pool.execute(
    `SELECT * FROM cart_items WHERE user_id = ? ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
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

// Delete cart item
async function removeCartItem(itemId, userId) {
  const [result] = await pool.execute(
    `DELETE FROM cart_items WHERE id = ? AND user_id = ?`,
    [itemId, userId]
  );

  return result.affectedRows > 0;
}

// Clear all cart items
async function clearCart(userId) {
  await pool.execute(`DELETE FROM cart_items WHERE user_id = ?`, [userId]);
  return true;
}

// Checkout - convert cart items to orders
async function checkout(userId) {
  const connection = await pool.getConnection();
  
  try {
    await connection.beginTransaction();

    // Get all cart items
    const [cartItems] = await connection.execute(
      `SELECT * FROM cart_items WHERE user_id = ?`,
      [userId]
    );

    if (cartItems.length === 0) {
      throw new Error('Cart is empty');
    }

    const orders = [];

    // Create order for each cart item
    for (const item of cartItems) {
      const orderData = {
        sender_name: item.sender_name,
        sender_phone: item.sender_phone,
        pickup_address: item.pickup_address,
        receiver_name: item.receiver_name,
        receiver_phone: item.receiver_phone,
        delivery_address: item.delivery_address,
        package_description: item.package_description,
        item_value: item.item_value,
        quantity: item.quantity,
        is_fragile: item.is_fragile,
        zone_id: item.zone_id,
        distance_km: item.distance_km,
        pickup_region_id: item.pickup_region_id,
        delivery_region_id: item.delivery_region_id,
      };

      // Use existing order service to create order
      const result = await orderService.createOrder(orderData, userId);
      orders.push(result);
    }

    // Clear cart after successful order creation
    await connection.execute(`DELETE FROM cart_items WHERE user_id = ?`, [userId]);

    await connection.commit();

    return orders;
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

    // Get the specific cart item
    const [cartItems] = await connection.execute(
      `SELECT * FROM cart_items WHERE id = ? AND user_id = ?`,
      [itemId, userId]
    );

    if (cartItems.length === 0) {
      throw new Error('Cart item not found');
    }

    const item = cartItems[0];

    // Create order data
    const orderData = {
      sender_name: item.sender_name,
      sender_phone: item.sender_phone,
      pickup_address: item.pickup_address,
      receiver_name: item.receiver_name,
      receiver_phone: item.receiver_phone,
      delivery_address: item.delivery_address,
      package_description: item.package_description,
      item_value: item.item_value,
      quantity: item.quantity,
      is_fragile: item.is_fragile,
      zone_id: item.zone_id,
      distance_km: item.distance_km,
      pickup_region_id: item.pickup_region_id,
      delivery_region_id: item.delivery_region_id,
    };

    // Use existing order service to create order
    const result = await orderService.createOrder(orderData, userId);

    // Remove this specific item from cart after successful order creation
    await connection.execute(`DELETE FROM cart_items WHERE id = ? AND user_id = ?`, [itemId, userId]);

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
  getCartItems,
  updateCartItem,
  removeCartItem,
  clearCart,
  checkout,
  checkoutSingleItem,
};
