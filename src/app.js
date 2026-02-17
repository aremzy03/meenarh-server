const express = require('express');
const cors = require('cors');
const publicRoutes = require('./routes/public.routes');
const userRoutes = require('./routes/user.routes');
const adminRoutes = require('./routes/admin.routes');
const cartRoutes = require('./routes/cart.routes');
const { publicLimiter } = require('./middleware/rateLimit.middleware');
const errorHandler = require('./middleware/error.middleware');

const app = express();

app.use(express.json());
app.use(cors());

// Rate limit only public routes
app.use('/api', publicLimiter);

// Routes
app.use('/api', publicRoutes);
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
