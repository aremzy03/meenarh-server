const { Router } = require('express');
const authMiddleware = require('../middleware/auth.middleware');
const paymentsController = require('../controllers/payments.controller');

const router = Router();

function requireCustomer(req, res, next) {
  if (req.user?.type !== 'customer') {
    return res.status(403).json({ success: false, message: 'Only customers can pay for cart orders.' });
  }
  next();
}

router.use(authMiddleware);
router.use(requireCustomer);

router.post('/paystack/initialize', paymentsController.initializePaystack);
router.post('/paystack/verify', paymentsController.verifyPaystack);

module.exports = router;
