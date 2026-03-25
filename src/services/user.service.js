const bcrypt = require('bcrypt');
const pool = require('../config/db');

async function createCustomer({ name, email, password, phone, default_address }) {
  const passwordHash = await bcrypt.hash(password, 10);
  
  const [result] = await pool.execute(
    'INSERT INTO customers (name, email, password_hash, phone, default_address, is_phone_verified) VALUES (?, ?, ?, ?, ?, ?)',
    [name, email, passwordHash, phone || null, default_address || null, 0]
  );

  return {
    id: result.insertId,
    name,
    email,
    phone: phone || null,
    default_address: default_address || null,
  };
}

async function getCustomerByEmail(email) {
  const [customers] = await pool.execute(
    'SELECT id, name, email, password_hash, phone, default_address, created_at FROM customers WHERE email = ?',
    [email]
  );
  return customers.length > 0 ? customers[0] : null;
}

async function getCustomerById(id) {
  const [customers] = await pool.execute(
    'SELECT id, name, email, phone, default_address, is_phone_verified, created_at, updated_at FROM customers WHERE id = ?',
    [id]
  );
  return customers.length > 0 ? customers[0] : null;
}

async function verifyCustomerPhoneByEmail(email) {
  const [customers] = await pool.execute(
    'SELECT id FROM customers WHERE email = ?',
    [email]
  );

  if (customers.length === 0) {
    return false;
  }

  const customer = customers[0];

  await pool.execute(
    'UPDATE customers SET is_phone_verified = 1 WHERE id = ?',
    [customer.id]
  );

  return true;
}

async function updateCustomerProfile(id, { phone, default_address }) {
  const updates = [];
  const values = [];

  if (phone !== undefined) {
    updates.push('phone = ?');
    values.push(phone);
  }

  if (default_address !== undefined) {
    updates.push('default_address = ?');
    values.push(default_address);
  }

  if (updates.length === 0) {
    return null;
  }

  values.push(id);

  await pool.execute(
    `UPDATE customers SET ${updates.join(', ')} WHERE id = ?`,
    values
  );

  return getCustomerById(id);
}

module.exports = {
  createCustomer,
  getCustomerByEmail,
  getCustomerById,
  updateCustomerProfile,
  verifyCustomerPhoneByEmail,
};
