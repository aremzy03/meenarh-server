const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const { handlePaystackWebhook } = require('./controllers/paystackWebhook.controller');
const publicRoutes = require('./routes/public.routes');
const userRoutes = require('./routes/user.routes');
const adminRoutes = require('./routes/admin.routes');
const cartRoutes = require('./routes/cart.routes');
const authRoutes = require('./routes/auth.routes');
const { publicRouter: blogPublicRouter } = require('./routes/blog.routes');
const { publicRouter: settingsPublicRouter } = require('./routes/settings.routes');
const { publicRouter: promoPublicRouter } = require('./routes/promo.routes');
const { publicRouter: analyticsPublicRouter } = require('./routes/analytics.routes');
const regionsRoutes = require('./routes/regions.routes');
const pricingRoutes = require('./routes/pricing.routes');
const { publicLimiter } = require('./middleware/rateLimit.middleware');
const errorHandler = require('./middleware/error.middleware');
const paymentsRoutes = require('./routes/payments.routes');
const { ensureCsrfCookie, requireCsrfIfCookieAuth } = require('./middleware/csrf.middleware');

const app = express();

// Required for secure cookies behind a reverse proxy (Hostinger / nginx).
app.set('trust proxy', 1);

function parseOrigins(value) {
  if (!value) return [];
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const allowedOrigins = [
  ...parseOrigins(process.env.FRONTEND_BASE_URL),
  ...parseOrigins(process.env.ADMIN_BASE_URL),
  ...parseOrigins(process.env.CORS_ORIGINS),
]
  .map((o) => o.replace(/\/$/, ''))
  // de-dupe
  .filter((v, i, a) => a.indexOf(v) === i);

if (allowedOrigins.length === 0 && process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:3000');
}

app.use(
  cors({
    origin(origin, cb) {
      // Non-browser clients (curl, server-to-server) often send no Origin.
      if (!origin) return cb(null, true);
      const normalized = origin.replace(/\/$/, '');
      if (allowedOrigins.length === 0) return cb(null, false);
      if (allowedOrigins.includes(normalized)) return cb(null, true);
      return cb(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
    credentials: true,
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'same-site' },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        // Next.js serves JS from self; disallow inline scripts.
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", 'data:', 'https:'],
        "connect-src": ["'self'", ...allowedOrigins],
        "base-uri": ["'self'"],
        "frame-ancestors": ["'none'"],
        "object-src": ["'none'"],
        "upgrade-insecure-requests": [],
      },
    },
    // We set CORS separately (and more explicitly) above.
    crossOriginEmbedderPolicy: false,
  })
);

app.use(cookieParser());
app.use(ensureCsrfCookie);

// Paystack webhook must see raw body for HMAC verification (before express.json)
app.post(
  '/api/webhooks/paystack',
  express.raw({ type: 'application/json' }),
  handlePaystackWebhook
);

app.use(express.json());
app.use(requireCsrfIfCookieAuth);

// Routes (do not put publicLimiter on `/api` — it would rate-limit cart, auth, etc.)
app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/blog', publicLimiter, blogPublicRouter);
app.use('/api/settings', publicLimiter, settingsPublicRouter);
app.use('/api/promo-codes', publicLimiter, promoPublicRouter);
app.use('/api/analytics', publicLimiter, analyticsPublicRouter);
app.use('/api/regions', publicLimiter, regionsRoutes);
app.use('/api/pricing', publicLimiter, pricingRoutes);

// Authenticated routes are not rate-limited by the public limiter
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/payments', paymentsRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
