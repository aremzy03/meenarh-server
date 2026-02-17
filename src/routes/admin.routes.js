const { Router } = require('express');
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middleware/auth.middleware');
const roleMiddleware = require('../middleware/role.middleware');
const { validateLogin, validateCreateAdminUser } = require('../validators/auth.validator');

const router = Router();

// Public admin route
router.post('/login', validateLogin, adminController.login);

// Protected admin routes
router.use(authMiddleware);
router.use(roleMiddleware('admin', 'staff'));

router.get('/orders', adminController.getOrders);
router.patch('/orders/:id/status', adminController.updateOrderStatus);
router.get('/customers', adminController.listCustomers);
router.post('/users', validateCreateAdminUser, adminController.createAdminUser);

module.exports = router;
