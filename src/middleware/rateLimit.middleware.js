const rateLimit = require('express-rate-limit');

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

module.exports = { publicLimiter };
