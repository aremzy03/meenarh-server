const { Router } = require('express');
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { loginLimiter, authLimiter } = require('../middleware/rateLimit.middleware');
const { validateSignup, validateLogin, validateUpdateProfile } = require('../validators/user.validator');

const router = Router();

// Public routes
router.post('/signup', validateSignup, userController.signup);
router.post('/login', loginLimiter, validateLogin, userController.login);
router.get('/verify-phone', userController.verifyPhone);

// Protected routes
router.use(authMiddleware);
router.use(authLimiter);
router.post('/phone-verification/request', userController.requestPhoneVerification);
router.post('/phone-verification/verify', userController.verifyPhoneVerificationCode);
router.get('/me', userController.me);
router.post('/logout', userController.logout);
router.get('/profile', userController.getProfile);
router.patch('/profile', validateUpdateProfile, userController.updateProfile);
router.get('/orders', userController.getOrderHistory);

module.exports = router;
