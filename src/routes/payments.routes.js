const { Router } = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const requireCustomerEmailVerified = require('../middleware/requireEmailVerified.middleware');
const paymentsController = require('../controllers/payments.controller');
const { authLimiter } = require('../middleware/rateLimit.middleware');

const router = Router();

function requireCustomer(req, res, next) {
  if (req.user?.kind !== 'customer') {
    return res.status(403).json({ success: false, message: 'Only customers can pay for cart orders.' });
  }
  next();
}

router.use(authMiddleware);
router.use(requireCustomer);
router.use(requireCustomerEmailVerified);
router.use(authLimiter);

router.post('/paystack/initialize', paymentsController.initializePaystack);
router.post('/paystack/verify', paymentsController.verifyPaystack);

module.exports = router;
