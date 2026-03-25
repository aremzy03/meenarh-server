const { Router } = require('express');
const userController = require('../controllers/user.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { validateSignup, validateLogin, validateUpdateProfile } = require('../validators/user.validator');

const router = Router();

// Public routes
router.post('/signup', validateSignup, userController.signup);
router.post('/login', validateLogin, userController.login);
router.get('/verify-phone', userController.verifyPhone);

// Protected routes
router.use(authMiddleware);
router.get('/profile', userController.getProfile);
router.patch('/profile', validateUpdateProfile, userController.updateProfile);
router.get('/orders', userController.getOrderHistory);

module.exports = router;
