const { Router } = require('express');
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middleware/auth.middleware');
const roleMiddleware = require('../middleware/role.middleware');
const { validateLogin, validateCreateAdminUser } = require('../validators/auth.validator');
const { adminRouter: blogAdminRouter } = require('./blog.routes');
const { adminRouter: settingsAdminRouter } = require('./settings.routes');
const { adminRouter: promoAdminRouter } = require('./promo.routes');
const { adminRouter: analyticsAdminRouter } = require('./analytics.routes');

const router = Router();

// Public admin route
router.post('/login', validateLogin, adminController.login);

// Protected admin routes
router.use(authMiddleware);
router.use(roleMiddleware('admin', 'staff'));

router.get('/orders', adminController.getOrders);
router.patch('/orders/:id/status', adminController.updateOrderStatus);
router.get('/customers', adminController.listCustomers);
router.get('/customers/:id', adminController.getCustomerById);
router.get('/customers/:id/orders', adminController.getCustomerOrders);
router.get('/customers/:id/cart', adminController.getCustomerCart);
router.post('/users', validateCreateAdminUser, adminController.createAdminUser);

// Sub-routers for new admin features
router.use('/blog', blogAdminRouter);
router.use('/settings', settingsAdminRouter);
router.use('/promo-codes', promoAdminRouter);
router.use('/analytics', analyticsAdminRouter);

module.exports = router;
