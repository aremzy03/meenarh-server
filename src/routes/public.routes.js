const { Router } = require('express');
const orderController = require('../controllers/order.controller');
const bulkOrderController = require('../controllers/bulkOrder.controller');
const authMiddleware = require('../middleware/auth.middleware');
const requireCustomerEmailVerified = require('../middleware/requireEmailVerified.middleware');
const { validateCreateOrder } = require('../validators/order.validator');
const { validateCreateBulkOrder } = require('../validators/bulkOrder.validator');
const { publicLimiter } = require('../middleware/rateLimit.middleware');

const router = Router();

router.use(publicLimiter);

router.post(
  '/orders',
  authMiddleware,
  requireCustomerEmailVerified,
  validateCreateOrder,
  orderController.createOrder
);

router.post(
  '/bulk-orders',
  authMiddleware,
  requireCustomerEmailVerified,
  validateCreateBulkOrder,
  bulkOrderController.createBulkOrder
);

router.get('/track/:trackingNumber', orderController.trackOrder);

module.exports = router;
