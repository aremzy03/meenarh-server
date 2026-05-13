const bcrypt = require('bcrypt');
const crypto = require('crypto');
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

async function deleteCustomerById(id) {
  await pool.execute('DELETE FROM customers WHERE id = ?', [id]);
}

async function getCustomerByEmail(email) {
  const [customers] = await pool.execute(
    'SELECT id, name, email, password_hash, phone, default_address, is_email_verified, created_at FROM customers WHERE email = ?',
    [email]
  );
  return customers.length > 0 ? customers[0] : null;
}

async function getCustomerById(id) {
  const [customers] = await pool.execute(
    'SELECT id, name, email, phone, default_address, is_phone_verified, is_email_verified, created_at, updated_at FROM customers WHERE id = ?',
    [id]
  );
  return customers.length > 0 ? customers[0] : null;
}

async function getCustomerByPhone(phone) {
  const [customers] = await pool.execute(
    'SELECT id, name, email, phone FROM customers WHERE phone = ?',
    [phone]
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

function generateSixDigitCode() {
  const n = crypto.randomInt(0, 1000000);
  return String(n).padStart(6, '0');
}

async function createPhoneVerificationCode(userId) {
  const code = generateSixDigitCode();
  const tokenHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const [result] = await pool.execute(
    `INSERT INTO phone_verifications (user_id, token_hash, expires_at, used, attempts, last_sent_at)
     VALUES (?, ?, ?, 0, 0, NOW())`,
    [userId, tokenHash, expiresAt]
  );

  return { id: result.insertId, code, expiresAt };
}

async function verifyPhoneCode(userId, code) {
  const normalized = String(code || '').trim();
  if (!/^\d{6}$/.test(normalized)) return { ok: false, reason: 'INVALID_CODE_FORMAT' };

  const [rows] = await pool.execute(
    `SELECT id, user_id, token_hash, expires_at, used, attempts
     FROM phone_verifications
     WHERE user_id = ? AND used = 0
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId]
  );

  if (!rows.length) return { ok: false, reason: 'NO_ACTIVE_CODE' };
  const row = rows[0];

  if (row.used) return { ok: false, reason: 'ALREADY_USED' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: 'EXPIRED' };
  if (Number(row.attempts) >= 5) return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };

  const match = await bcrypt.compare(normalized, row.token_hash);
  if (!match) {
    await pool.execute('UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = ?', [row.id]);
    return { ok: false, reason: 'INVALID_CODE' };
  }

  await pool.execute('UPDATE phone_verifications SET used = 1 WHERE id = ?', [row.id]);
  await pool.execute('UPDATE customers SET is_phone_verified = 1 WHERE id = ?', [row.user_id]);

  return { ok: true, userId: row.user_id };
}

const PASSWORD_RESET_RESEND_SECONDS = 45;

async function createPasswordResetCode(userId) {
  const [prior] = await pool.execute(
    `SELECT last_sent_at FROM password_resets WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  if (prior.length && prior[0].last_sent_at) {
    const last = new Date(prior[0].last_sent_at).getTime();
    if (Date.now() - last < PASSWORD_RESET_RESEND_SECONDS * 1000) {
      return { skipped: true, code: null };
    }
  }

  const code = generateSixDigitCode();
  const tokenHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await pool.execute(
    `INSERT INTO password_resets (user_id, token_hash, expires_at, used, attempts, last_sent_at)
     VALUES (?, ?, ?, 0, 0, NOW())`,
    [userId, tokenHash, expiresAt]
  );

  return { skipped: false, code };
}

async function resetPasswordWithOtp({ phone, code, newPassword }) {
  const normalized = String(code || '').trim();
  if (!/^\d{6}$/.test(normalized)) {
    return { ok: false, reason: 'INVALID_CODE_FORMAT' };
  }

  const customer = phone ? await getCustomerByPhone(phone) : null;
  if (!customer) return { ok: false, reason: 'NOT_FOUND_OR_INVALID' };

  const [rows] = await pool.execute(
    `SELECT id, user_id, token_hash, expires_at, used, attempts
     FROM password_resets
     WHERE user_id = ? AND used = 0
     ORDER BY created_at DESC
     LIMIT 1`,
    [customer.id]
  );

  if (!rows.length) return { ok: false, reason: 'NOT_FOUND_OR_INVALID' };
  const row = rows[0];

  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: 'EXPIRED' };
  if (Number(row.attempts) >= 5) return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };

  const match = await bcrypt.compare(normalized, row.token_hash);
  if (!match) {
    await pool.execute('UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?', [row.id]);
    return { ok: false, reason: 'INVALID_CODE' };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await pool.execute('UPDATE customers SET password_hash = ? WHERE id = ?', [passwordHash, row.user_id]);
  await pool.execute('UPDATE password_resets SET used = 1 WHERE id = ?', [row.id]);

  return { ok: true };
}

const EMAIL_VERIFICATION_TOKEN_BYTES = 32;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const EMAIL_VERIFICATION_RESEND_SECONDS = 60;

function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function createEmailVerificationToken(userId, { enforceCooldown = false } = {}) {
  if (enforceCooldown) {
    const [prior] = await pool.execute(
      `SELECT last_sent_at FROM email_verifications
       WHERE user_id = ? AND used = 0
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (prior.length && prior[0].last_sent_at) {
      const last = new Date(prior[0].last_sent_at).getTime();
      if (Date.now() - last < EMAIL_VERIFICATION_RESEND_SECONDS * 1000) {
        return { skipped: true, token: null };
      }
    }
  }

  // Invalidate any prior unused tokens so only the latest link works.
  await pool.execute(
    'UPDATE email_verifications SET used = 1 WHERE user_id = ? AND used = 0',
    [userId]
  );

  const token = crypto.randomBytes(EMAIL_VERIFICATION_TOKEN_BYTES).toString('base64url');
  const tokenSha256 = sha256Hex(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

  await pool.execute(
    `INSERT INTO email_verifications (user_id, token_sha256, expires_at, used, last_sent_at)
     VALUES (?, ?, ?, 0, NOW())`,
    [userId, tokenSha256, expiresAt]
  );

  return { skipped: false, token, expiresAt };
}

async function verifyEmailToken(plaintextToken) {
  const trimmed = String(plaintextToken || '').trim();
  if (!trimmed) return { ok: false, reason: 'INVALID_TOKEN' };

  const tokenSha256 = sha256Hex(trimmed);

  const [rows] = await pool.execute(
    `SELECT id, user_id, expires_at, used
     FROM email_verifications
     WHERE token_sha256 = ?
     LIMIT 1`,
    [tokenSha256]
  );

  if (!rows.length) return { ok: false, reason: 'INVALID_TOKEN' };
  const row = rows[0];

  if (row.used) return { ok: false, reason: 'ALREADY_USED' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: 'EXPIRED' };

  await pool.execute('UPDATE email_verifications SET used = 1 WHERE id = ?', [row.id]);
  await pool.execute('UPDATE customers SET is_email_verified = 1 WHERE id = ?', [row.user_id]);

  return { ok: true, userId: row.user_id };
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
  deleteCustomerById,
  getCustomerByEmail,
  getCustomerById,
  getCustomerByPhone,
  updateCustomerProfile,
  verifyCustomerPhoneByEmail,
  createPhoneVerificationCode,
  verifyPhoneCode,
  createPasswordResetCode,
  resetPasswordWithOtp,
  createEmailVerificationToken,
  verifyEmailToken,
};
