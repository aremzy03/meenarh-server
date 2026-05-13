const { Router } = require('express');
const userService = require('../services/user.service');
const { publicLimiter } = require('../middleware/rateLimit.middleware');
const { sendTemplateMessage } = require('../services/whatsapp.service');
const { sendPasswordResetEmail } = require('../services/email.service');

const router = Router();

const RESET_SUCCESS_MESSAGE =
  'If an account exists for this phone, a verification code has been sent via WhatsApp.';

router.post('/forgot-password', publicLimiter, async (req, res, next) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ success: false, message: 'Phone is required' });
    }

    const customer = await userService.getCustomerByPhone(phone);

    if (!customer || !customer.phone) {
      return res.json({
        success: true,
        message: RESET_SUCCESS_MESSAGE,
      });
    }

    const { skipped, code } = await userService.createPasswordResetCode(customer.id);

    if (!skipped && code) {
      if (customer.phone) {
        sendTemplateMessage({
          to: customer.phone,
          templateName: 'password_reset_code',
          languageCode: 'en',
          components: [
            {
              type: 'body',
              parameters: [{ type: 'text', text: code }],
            },
          ],
        });
      }

      if (customer.email) {
        sendPasswordResetEmail({
          to: customer.email,
          name: customer.name,
          code,
          userId: customer.id,
        });
      }
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
    const { phone, code, newPassword } = req.body;

    if (!phone || !code || !newPassword) {
      return res
        .status(400)
        .json({ success: false, message: 'Phone, code, and newPassword are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const result = await userService.resetPasswordWithOtp({
      phone,
      code,
      newPassword,
    });

    if (!result.ok) {
      if (result.reason === 'INVALID_CODE_FORMAT') {
        return res.status(400).json({
          success: false,
          message: 'Enter the 6-digit code sent to your WhatsApp.',
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
