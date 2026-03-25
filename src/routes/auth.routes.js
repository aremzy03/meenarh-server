const { Router } = require('express');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { signToken } = require('../utils/jwt');
const { publicLimiter } = require('../middleware/rateLimit.middleware');
const { sendTemplateMessage } = require('../services/whatsapp.service');

const router = Router();

router.post('/forgot-password', publicLimiter, async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone is required' });
    }

    const [customers] = await pool.execute(
      'SELECT id, name, phone FROM customers WHERE phone = ?',
      [phone]
    );

    // Always respond with success to avoid user enumeration
    if (customers.length === 0) {
      return res.json({
        success: true,
        message: 'If an account exists for this phone, a reset link has been sent.',
      });
    }

    const customer = customers[0];

    const rawToken = `${customer.id}.${Date.now()}.${Math.random().toString(36).slice(2, 10)}`;
    const tokenHash = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    await pool.execute(
      `INSERT INTO password_resets (user_id, token_hash, expires_at, used)
       VALUES (?, ?, ?, 0)`,
      [customer.id, tokenHash, expiresAt]
    );

    const frontendBaseUrl = process.env.FRONTEND_BASE_URL;
    if (frontendBaseUrl && customer.phone) {
      const resetUrl = `${frontendBaseUrl.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(
        rawToken
      )}`;

      sendTemplateMessage({
        to: customer.phone,
        templateName: 'password_reset_link',
        languageCode: 'en',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: customer.name || 'there' },
              { type: 'text', text: resetUrl },
            ],
          },
        ],
      });
    }

    return res.json({
      success: true,
      message: 'If an account exists for this phone, a reset link has been sent.',
    });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', publicLimiter, async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, message: 'Token and newPassword are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const [rows] = await pool.execute(
      `SELECT id, user_id, token_hash, expires_at, used
       FROM password_resets
       WHERE used = 0
       ORDER BY created_at DESC
       LIMIT 50`
    );

    let matchRow = null;
    // Find matching token with constant-time comparison at bcrypt level
    // eslint-disable-next-line no-restricted-syntax
    for (const row of rows) {
      // eslint-disable-next-line no-await-in-loop
      const match = await bcrypt.compare(token, row.token_hash);
      if (match) {
        matchRow = row;
        break;
      }
    }

    if (!matchRow) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    if (new Date(matchRow.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired token' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await pool.execute('UPDATE customers SET password_hash = ? WHERE id = ?', [
      passwordHash,
      matchRow.user_id,
    ]);

    await pool.execute('UPDATE password_resets SET used = 1 WHERE id = ?', [matchRow.id]);

    return res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

