const { Router } = require('express');
const userService = require('../services/user.service');
const { publicLimiter } = require('../middleware/rateLimit.middleware');
const { sendPasswordResetEmail } = require('../services/email.service');

const router = Router();

const RESET_SUCCESS_MESSAGE =
  'If an account exists for this email, a verification code has been sent.';

router.post('/forgot-password', publicLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }

    const customer = await userService.getCustomerByEmail(email);

    if (!customer || !customer.email) {
      return res.json({
        success: true,
        message: RESET_SUCCESS_MESSAGE,
      });
    }

    const { skipped, code } = await userService.createPasswordResetCode(customer.id);

    if (!skipped && code) {
      sendPasswordResetEmail({
        to: customer.email,
        name: customer.name,
        code,
        userId: customer.id,
      });
    }

    return res.json({
      success: true,
      message: RESET_SUCCESS_MESSAGE,
    });
  } catch (err) {
    next(err);
  }
});

const GENERIC_RESET_FAILURE = 'Invalid or expired code.';

router.post('/reset-password', publicLimiter, async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res
        .status(400)
        .json({ success: false, message: 'Email, code, and newPassword are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const result = await userService.resetPasswordWithOtpByEmail({
      email,
      code,
      newPassword,
    });

    if (!result.ok) {
      if (result.reason === 'INVALID_CODE_FORMAT') {
        return res.status(400).json({
          success: false,
          message: 'Enter the 6-digit code sent to your email.',
        });
      }
      return res.status(400).json({ success: false, message: GENERIC_RESET_FAILURE });
    }

    return res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
