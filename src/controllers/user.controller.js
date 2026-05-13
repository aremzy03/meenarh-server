const bcrypt = require('bcrypt');
const userService = require('../services/user.service');
const orderService = require('../services/order.service');
const bulkOrderService = require('../services/bulkOrder.service');
const { signToken, sessionCookieOptions } = require('../utils/jwt');
const { sendTemplateMessage } = require('../services/whatsapp.service');
const { sendEmailVerificationEmail } = require('../services/email.service');
const {
  isEmailVerificationFullyConfigured,
  isEmailVerificationEnforced,
} = require('../utils/emailVerification');

function buildEmailVerificationUrl(token) {
  const apiBase = (process.env.API_PUBLIC_URL || '').replace(/\/$/, '');
  if (!apiBase) return null;
  return `${apiBase}/api/user/verify-email?token=${encodeURIComponent(token)}`;
}

async function signup(req, res, next) {
  try {
    const { name, email, password, phone, default_address } = req.body;

    // Check if email already exists
    const existing = await userService.getCustomerByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    const verificationConfigured = isEmailVerificationFullyConfigured();
    if (process.env.NODE_ENV === 'production' && !verificationConfigured) {
      return res.status(503).json({
        success: false,
        message: 'Registration is temporarily unavailable. Please try again later.',
      });
    }

    // Create customer
    const customer = await userService.createCustomer({
      name,
      email,
      password,
      phone,
      default_address,
    });

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
            // WhatsApp Authentication category: single placeholder {{1}} = 6-digit code
            parameters: [{ type: 'text', text: code }],
          },
        ],
      });
    }

    let verificationEmailSent = false;
    if (customer.email) {
      try {
        const { token: emailVerifyToken } = await userService.createEmailVerificationToken(
          customer.id
        );
        const verificationUrl = emailVerifyToken
          ? buildEmailVerificationUrl(emailVerifyToken)
          : null;
        if (verificationUrl && verificationConfigured) {
          const sent = await sendEmailVerificationEmail({
            to: customer.email,
            name: customer.name,
            verificationUrl,
            userId: customer.id,
          });
          verificationEmailSent = Boolean(sent);
          if (process.env.NODE_ENV === 'production' && !verificationEmailSent) {
            // eslint-disable-next-line no-console
            console.error('[UserController] Verification email was not accepted by Resend', {
              userId: customer.id,
            });
            await userService.deleteCustomerById(customer.id);
            return res.status(502).json({
              success: false,
              message: 'Could not send verification email. Please try again in a moment.',
            });
          }
        } else if (verificationConfigured && !verificationUrl) {
          // eslint-disable-next-line no-console
          console.error('[UserController] Missing verification URL after token issue', {
            userId: customer.id,
          });
          if (process.env.NODE_ENV === 'production') {
            await userService.deleteCustomerById(customer.id);
            return res.status(500).json({
              success: false,
              message: 'Could not complete registration. Please try again.',
            });
          }
        }
      } catch (notifyErr) {
        // eslint-disable-next-line no-console
        console.error('[UserController] Failed to issue email verification token', notifyErr);
        if (process.env.NODE_ENV === 'production') {
          await userService.deleteCustomerById(customer.id);
          return res.status(500).json({
            success: false,
            message: 'Could not complete registration. Please try again.',
          });
        }
      }
    }

    if (!verificationConfigured && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn(
        '[UserController] Signup: set API_PUBLIC_URL, RESEND_API_KEY, and EMAIL_FROM to send verification emails.'
      );
    }

    const sessionToken = signToken({ id: customer.id, email: customer.email, kind: 'customer' });
    res.cookie('meenarh_customer_token', sessionToken, sessionCookieOptions());

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
          is_email_verified: false,
          email_verification_enforced: isEmailVerificationEnforced(),
        },
        verificationEmailSent,
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

    if (!customer.is_email_verified && isEmailVerificationEnforced()) {
      return res.status(403).json({
        success: false,
        message:
          'Please verify your email before signing in. Check your inbox for the verification link.',
        code: 'EMAIL_NOT_VERIFIED',
      });
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
          is_email_verified: Boolean(customer.is_email_verified),
          email_verification_enforced: isEmailVerificationEnforced(),
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

async function logout(req, res) {
  const secure = process.env.NODE_ENV === 'production';

  // Mirror the attributes used when the cookie was issued (see utils/jwt.js).
  // Some browsers will only evict a cookie when path / sameSite / secure / httpOnly
  // match what was originally set.
  const sessionCookieAttrs = {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  };

  res.clearCookie('meenarh_customer_token', sessionCookieAttrs);

  // Defensive: if an admin token happens to share this browser session, clear it
  // too so the logout button on the user dashboard always ends *all* sessions
  // for this device.
  if (req.cookies && req.cookies.meenarh_admin_token) {
    res.clearCookie('meenarh_admin_token', sessionCookieAttrs);
  }

  // Rotate the CSRF cookie so the next session does not reuse the previous
  // double-submit secret. ensureCsrfCookie will mint a fresh one on the next
  // request.
  res.clearCookie('csrf_token', {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
  });

  // Prevent intermediaries / the browser from caching an authenticated response
  // after logout and instruct the browser to wipe cookies + storage for the API
  // origin where possible.
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Clear-Site-Data', '"cookies", "storage"');

  return res.status(200).json({ success: true, message: 'Logged out' });
}

async function me(req, res) {
  // Auth middleware already validated token
  const customer = await userService.getCustomerById(req.user.id);
  if (!customer) return res.status(404).json({ success: false, message: 'User not found' });
  return res.json({
    success: true,
    data: {
      ...customer,
      email_verification_enforced: isEmailVerificationEnforced(),
    },
  });
}

async function getProfile(req, res, next) {
  try {
    const customer = await userService.getCustomerById(req.user.id);

    if (!customer) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      data: {
        ...customer,
        email_verification_enforced: isEmailVerificationEnforced(),
      },
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
      data: {
        ...updated,
        email_verification_enforced: isEmailVerificationEnforced(),
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getOrderHistory(req, res, next) {
  try {
    const userId = req.user.id;
    const [singleOrders, bulkOrders] = await Promise.all([
      orderService.getOrdersByUserId(userId),
      bulkOrderService.getBulkOrdersByUserId(userId),
    ]);

    const combined = [
      ...singleOrders.map((o) => ({ ...o, type: 'single' })),
      ...bulkOrders.map((b) => ({ ...b, type: 'bulk' })),
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({
      success: true,
      data: combined,
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
          parameters: [{ type: 'text', text: code }],
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

function buildVerifyEmailRedirect(status) {
  const base = (process.env.FRONTEND_BASE_URL || '').replace(/\/$/, '');
  if (!base) return null;
  return `${base}/dashboard/verify-email?status=${encodeURIComponent(status)}`;
}

async function verifyEmail(req, res, next) {
  try {
    const { token } = req.query;
    const result = await userService.verifyEmailToken(token);

    const statusKey = result.ok
      ? 'verified'
      : result.reason === 'EXPIRED'
        ? 'expired'
        : result.reason === 'ALREADY_USED'
          ? 'already_used'
          : 'invalid';

    const redirectUrl = buildVerifyEmailRedirect(statusKey);
    if (redirectUrl) {
      return res.redirect(302, redirectUrl);
    }

    if (!result.ok) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification link.',
        reason: result.reason,
      });
    }

    return res.json({ success: true, message: 'Email verified successfully' });
  } catch (err) {
    next(err);
  }
}

async function requestEmailVerification(req, res, next) {
  try {
    const customer = await userService.getCustomerById(req.user.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    if (!customer.email) {
      return res.status(400).json({ success: false, message: 'Email address is required' });
    }
    if (customer.is_email_verified) {
      return res.status(400).json({ success: false, message: 'Email is already verified' });
    }

    const { skipped, token } = await userService.createEmailVerificationToken(customer.id, {
      enforceCooldown: true,
    });

    if (skipped) {
      return res.status(429).json({
        success: false,
        message: 'Please wait a moment before requesting another verification email.',
      });
    }

    const verificationUrl = buildEmailVerificationUrl(token);
    if (verificationUrl) {
      sendEmailVerificationEmail({
        to: customer.email,
        name: customer.name,
        verificationUrl,
        userId: customer.id,
      });
    }

    return res.json({ success: true, message: 'Verification email sent' });
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
  verifyEmail,
  requestEmailVerification,
};
