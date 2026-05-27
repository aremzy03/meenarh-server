const { Router } = require('express');
const adminController = require('../controllers/admin.controller');
const bulkOrderController = require('../controllers/bulkOrder.controller');
const authMiddleware = require('../middleware/auth.middleware');
const roleMiddleware = require('../middleware/role.middleware');
const { loginLimiter, authLimiter } = require('../middleware/rateLimit.middleware');
const { validateLogin, validateCreateAdminUser } = require('../validators/auth.validator');
const { adminRouter: blogAdminRouter } = require('./blog.routes');
const { adminRouter: settingsAdminRouter } = require('./settings.routes');
const { adminRouter: promoAdminRouter } = require('./promo.routes');
const { adminRouter: analyticsAdminRouter } = require('./analytics.routes');
const regionAdminRouter = require('./regionAdmin.routes');

const router = Router();

// Public admin route
router.post('/login', loginLimiter, validateLogin, adminController.login);

// Protected admin routes
router.use(authMiddleware);
router.use(roleMiddleware('admin', 'staff'));
router.use(authLimiter);

router.get('/me', adminController.me);
router.post('/logout', adminController.logout);
router.get('/orders', adminController.getOrders);
router.get('/orders/:id', adminController.getOrderById);
router.patch('/orders/:id/status', adminController.updateOrderStatus);

// Bulk order admin routes
router.get('/bulk-orders', bulkOrderController.getAllBulkOrders);
router.get('/bulk-orders/:id', bulkOrderController.getBulkOrderDetail);
router.patch('/bulk-orders/:bulkId/items/:itemId/status', bulkOrderController.updateBulkItemStatus);

router.get('/customers', adminController.listCustomers);
router.get('/customers/:id', adminController.getCustomerById);
router.get('/customers/:id/orders', adminController.getCustomerOrders);
router.get('/customers/:id/bulk-orders', adminController.getCustomerBulkOrders);
router.get('/customers/:id/cart', adminController.getCustomerCart);
router.post('/users', validateCreateAdminUser, adminController.createAdminUser);

// Sub-routers for new admin features
router.use('/blog', blogAdminRouter);
router.use('/settings', settingsAdminRouter);
router.use('/promo-codes', promoAdminRouter);
router.use('/analytics', analyticsAdminRouter);
router.use('/regions', regionAdminRouter);

module.exports = router;
