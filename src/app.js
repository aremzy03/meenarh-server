const express = require('express');
const cors = require('cors');
const publicRoutes = require('./routes/public.routes');
const userRoutes = require('./routes/user.routes');
const adminRoutes = require('./routes/admin.routes');
const cartRoutes = require('./routes/cart.routes');
const authRoutes = require('./routes/auth.routes');
const { publicRouter: blogPublicRouter } = require('./routes/blog.routes');
const { publicRouter: settingsPublicRouter } = require('./routes/settings.routes');
const { publicRouter: promoPublicRouter } = require('./routes/promo.routes');
const { publicRouter: analyticsPublicRouter } = require('./routes/analytics.routes');
const { publicLimiter } = require('./middleware/rateLimit.middleware');
const errorHandler = require('./middleware/error.middleware');

const app = express();

app.use(express.json());
app.use(cors());

// Routes
// Apply rate limiting only to unauthenticated/public routes
app.use('/api', publicLimiter, publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/blog', publicLimiter, blogPublicRouter);
app.use('/api/settings', publicLimiter, settingsPublicRouter);
app.use('/api/promo-codes', publicLimiter, promoPublicRouter);
app.use('/api/analytics', publicLimiter, analyticsPublicRouter);

// Authenticated routes are not rate-limited by the public limiter
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/cart', cartRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Global error handler (must be last)
app.use(errorHandler);

module.exports = app;
