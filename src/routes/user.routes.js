const { Router } = require('express');
const userController = require('../controllers/user.controller');
const bulkOrderController = require('../controllers/bulkOrder.controller');
const authMiddleware = require('../middleware/auth.middleware');
const requireCustomerEmailVerified = require('../middleware/requireEmailVerified.middleware');
const { loginLimiter, authLimiter } = require('../middleware/rateLimit.middleware');
const { validateSignup, validateLogin, validateUpdateProfile } = require('../validators/user.validator');

const router = Router();

// Public routes
router.post('/signup', validateSignup, userController.signup);
router.post('/login', loginLimiter, validateLogin, userController.login);
router.get('/verify-email', userController.verifyEmail);

// Protected routes
router.use(authMiddleware);
router.use(authLimiter);

// Allowed before email verification (session bootstrap + resend link)
router.get('/me', userController.me);
router.post('/logout', userController.logout);
router.post('/email-verification/request', userController.requestEmailVerification);

router.use(requireCustomerEmailVerified);

router.get('/profile', userController.getProfile);
router.patch('/profile', validateUpdateProfile, userController.updateProfile);
router.get('/orders', userController.getOrderHistory);

// Bulk order endpoints (user-scoped)
router.get('/bulk-orders', bulkOrderController.getUserBulkOrders);
router.get('/bulk-orders/:id', bulkOrderController.getUserBulkOrderDetail);

module.exports = router;
