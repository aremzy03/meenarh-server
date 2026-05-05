const { Router } = require('express');
const cartController = require('../controllers/cart.controller');
const authMiddleware = require('../middleware/auth.middleware');
const { authLimiter } = require('../middleware/rateLimit.middleware');
const { validateCreateOrder } = require('../validators/order.validator');

const router = Router();

// All cart routes require authentication
router.use(authMiddleware);
router.use(authLimiter);

router.post('/', validateCreateOrder, cartController.addToCart);
router.get('/', cartController.getCart);
router.patch('/:id', validateCreateOrder, cartController.updateCartItem);
router.delete('/:id', cartController.removeCartItem);
router.delete('/', cartController.clearCart);
router.post('/checkout', cartController.checkout);
router.post('/checkout/:id', cartController.checkoutSingleItem);

module.exports = router;
