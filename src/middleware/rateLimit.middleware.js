const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

// Only for unauthenticated/public endpoints (not mounted on /api/cart etc.)
const isProd = process.env.NODE_ENV === 'production';

const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  // Stricter in production; dev needs headroom for HMR, refetches, and multiple tabs
  max: isProd ? 400 : 5000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 20 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = (req.body?.email || '').toString().toLowerCase().trim();
    return `${ipKeyGenerator(req)}:${email}`;
  },
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProd ? 600 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `${req.user?.id ?? ipKeyGenerator(req)}`,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

module.exports = { publicLimiter, loginLimiter, authLimiter };
