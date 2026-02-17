const { Router } = require('express');
const orderController = require('../controllers/order.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { validateCreateOrder } = require('../validators/order.validator');

const router = Router();

router.post('/orders', authMiddleware, validateCreateOrder, orderController.createOrder);
router.get('/track/:trackingNumber', orderController.trackOrder);

module.exports = router;
