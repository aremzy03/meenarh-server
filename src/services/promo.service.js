const pool = require('../config/db');

async function createPromoCode({ code, discount_type, discount_value, min_order_value, max_uses, expires_at }) {
  const [result] = await pool.execute(
    `INSERT INTO promo_codes (code, discount_type, discount_value, min_order_value, max_uses, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      code.toUpperCase(),
      discount_type,
      discount_value,
      min_order_value || null,
      max_uses || null,
      expires_at || null,
    ]
  );

  return { id: result.insertId, code: code.toUpperCase() };
}

async function getAllPromoCodes() {
  const [codes] = await pool.execute(
    `SELECT id, code, discount_type, discount_value, min_order_value, max_uses, current_uses,
            expires_at, is_active, created_at, updated_at
     FROM promo_codes
     ORDER BY created_at DESC`
  );
  return codes;
}

async function getPromoCodeById(id) {
  const [codes] = await pool.execute('SELECT * FROM promo_codes WHERE id = ?', [id]);
  if (codes.length === 0) return null;

  const [usage] = await pool.execute(
    `SELECT pu.id, pu.discount_applied, pu.used_at,
            c.name as customer_name, c.email as customer_email,
            o.tracking_number,
            pi.reference as payment_reference
     FROM promo_usage pu
     LEFT JOIN customers c ON pu.customer_id = c.id
     LEFT JOIN orders o ON pu.order_id = o.id
     LEFT JOIN payment_intents pi ON pu.payment_intent_id = pi.id
     WHERE pu.promo_code_id = ?
     ORDER BY pu.used_at DESC`,
    [id]
  );

  return { ...codes[0], usage };
}

async function updatePromoCode(id, data) {
  const fields = [];
  const values = [];

  const allowed = ['code', 'discount_type', 'discount_value', 'min_order_value', 'max_uses', 'expires_at', 'is_active'];

  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(key === 'code' ? data[key].toUpperCase() : data[key]);
    }
  }

  if (fields.length === 0) return false;

  values.push(id);
  await pool.execute(`UPDATE promo_codes SET ${fields.join(', ')} WHERE id = ?`, values);
  return true;
}

async function togglePromoCode(id) {
  await pool.execute('UPDATE promo_codes SET is_active = NOT is_active WHERE id = ?', [id]);
  const [codes] = await pool.execute('SELECT is_active FROM promo_codes WHERE id = ?', [id]);
  return codes[0]?.is_active;
}

async function deletePromoCode(id) {
  const [result] = await pool.execute('DELETE FROM promo_codes WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

async function validatePromoCode(code, orderTotal) {
  const [codes] = await pool.execute(
    'SELECT * FROM promo_codes WHERE code = ? AND is_active = TRUE',
    [code.toUpperCase()]
  );

  if (codes.length === 0) {
    return { valid: false, message: 'Invalid promo code' };
  }

  const promo = codes[0];

  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return { valid: false, message: 'This promo code has expired' };
  }

  if (promo.max_uses !== null && promo.current_uses >= promo.max_uses) {
    return { valid: false, message: 'This promo code has reached its usage limit' };
  }

  if (promo.min_order_value !== null && orderTotal < parseFloat(promo.min_order_value)) {
    return {
      valid: false,
      message: `Minimum order value of ₦${parseFloat(promo.min_order_value).toLocaleString()} required`,
    };
  }

  let discount = 0;
  if (promo.discount_type === 'percentage') {
    discount = (orderTotal * parseFloat(promo.discount_value)) / 100;
  } else {
    discount = parseFloat(promo.discount_value);
  }

  discount = Math.min(discount, orderTotal);

  return {
    valid: true,
    promo_code_id: promo.id,
    discount_type: promo.discount_type,
    discount_value: parseFloat(promo.discount_value),
    discount,
    new_total: orderTotal - discount,
  };
}

async function recordUsage({
  promoCodeId,
  customerId,
  orderId = null,
  paymentIntentId = null,
  discountApplied,
}) {
  await pool.execute(
    `INSERT INTO promo_usage (
      promo_code_id, customer_id, payment_intent_id, order_id, discount_applied
    ) VALUES (?, ?, ?, ?, ?)`,
    [promoCodeId, customerId, paymentIntentId, orderId, discountApplied]
  );
  await pool.execute(
    'UPDATE promo_codes SET current_uses = current_uses + 1 WHERE id = ?',
    [promoCodeId]
  );
}

module.exports = {
  createPromoCode, getAllPromoCodes, getPromoCodeById, updatePromoCode,
  togglePromoCode, deletePromoCode, validatePromoCode, recordUsage,
};
