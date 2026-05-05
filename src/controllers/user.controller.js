const bcrypt = require('bcrypt');
const userService = require('../services/user.service');
const orderService = require('../services/order.service');
const { signToken, sessionCookieOptions } = require('../utils/jwt');
const { sendTemplateMessage } = require('../services/whatsapp.service');

async function signup(req, res, next) {
  try {
    const { name, email, password, phone, default_address } = req.body;

    // Check if email already exists
    const existing = await userService.getCustomerByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Create customer
    const customer = await userService.createCustomer({
      name,
      email,
      password,
      phone,
      default_address,
    });

    // Generate JWT
    const token = signToken({ id: customer.id, email: customer.email, kind: 'customer' });
    res.cookie('meenarh_customer_token', token, sessionCookieOptions());

    // Send WhatsApp phone verification code (non-blocking)
    if (customer.phone) {
      const { code } = await userService.createPhoneVerificationCode(customer.id);
      sendTemplateMessage({
        to: customer.phone,
        templateName: 'phone_verification_code',
        languageCode: 'en',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: customer.name || 'there' }, // {{1}}
              { type: 'text', text: code }, // {{2}}
              { type: 'text', text: '10' }, // {{3}} minutes (optional)
            ],
          },
        ],
      });
    }

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      data: {
        user: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          default_address: customer.default_address,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    // Get customer by email
    const customer = await userService.getCustomerByEmail(email);
    if (!customer) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Compare password
    const match = await bcrypt.compare(password, customer.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Generate JWT
    const token = signToken({ id: customer.id, email: customer.email, kind: 'customer' });
    res.cookie('meenarh_customer_token', token, sessionCookieOptions());

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          default_address: customer.default_address,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function logout(_req, res) {
  const secure = process.env.NODE_ENV === 'production';
  res.clearCookie('meenarh_customer_token', { path: '/', sameSite: 'lax', secure });
  return res.json({ success: true, message: 'Logged out' });
}

async function me(req, res) {
  // Auth middleware already validated token
  const customer = await userService.getCustomerById(req.user.id);
  if (!customer) return res.status(404).json({ success: false, message: 'User not found' });
  return res.json({ success: true, data: customer });
}

async function getProfile(req, res, next) {
  try {
    const customer = await userService.getCustomerById(req.user.id);

    if (!customer) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      data: customer,
    });
  } catch (err) {
    next(err);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { phone, default_address } = req.body;

    const updated = await userService.updateCustomerProfile(req.user.id, {
      phone,
      default_address,
    });

    if (!updated) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updated,
    });
  } catch (err) {
    next(err);
  }
}

async function getOrderHistory(req, res, next) {
  try {
    const orders = await orderService.getOrdersByUserId(req.user.id);

    res.json({
      success: true,
      data: orders,
    });
  } catch (err) {
    next(err);
  }
}

async function requestPhoneVerification(req, res, next) {
  try {
    const customer = await userService.getCustomerById(req.user.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!customer.phone) {
      return res.status(400).json({ success: false, message: 'Phone number is required' });
    }

    const { code } = await userService.createPhoneVerificationCode(customer.id);
    sendTemplateMessage({
      to: customer.phone,
      templateName: 'phone_verification_code',
      languageCode: 'en',
      components: [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: customer.name || 'there' }, // {{1}}
            { type: 'text', text: code }, // {{2}}
            { type: 'text', text: '10' }, // {{3}} minutes (optional)
          ],
        },
      ],
    });

    return res.json({ success: true, message: 'Verification code sent' });
  } catch (err) {
    next(err);
  }
}

async function verifyPhoneVerificationCode(req, res, next) {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Code is required' });
    }

    const result = await userService.verifyPhoneCode(req.user.id, code);
    if (!result.ok) {
      const message =
        result.reason === 'EXPIRED'
          ? 'Verification code expired'
          : result.reason === 'TOO_MANY_ATTEMPTS'
            ? 'Too many attempts. Request a new code.'
            : 'Invalid verification code';
      return res.status(400).json({ success: false, message, reason: result.reason });
    }

    const customer = await userService.getCustomerById(req.user.id);
    return res.json({
      success: true,
      message: 'Phone number verified successfully',
      data: customer,
    });
  } catch (err) {
    next(err);
  }
}

async function verifyPhone(req, res, next) {
  try {
    // Link-based verification has been deprecated in favor of OTP codes.
    const redirectUrl = process.env.FRONTEND_BASE_URL
      ? `${process.env.FRONTEND_BASE_URL.replace(/\/$/, '')}/dashboard/verify-phone`
      : null;

    if (redirectUrl) return res.redirect(302, redirectUrl);
    return res.status(410).json({
      success: false,
      message: 'Phone verification links are no longer supported. Request a verification code instead.',
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  signup,
  login,
  logout,
  me,
  getProfile,
  updateProfile,
  getOrderHistory,
  requestPhoneVerification,
  verifyPhoneVerificationCode,
  verifyPhone,
};
