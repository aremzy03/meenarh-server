const { Router } = require('express');
const cartController = require('../controllers/cart.controller');
const authMiddleware = require('../middleware/auth.middleware');
const requireCustomerEmailVerified = require('../middleware/requireEmailVerified.middleware');
const { authLimiter } = require('../middleware/rateLimit.middleware');
const { validateCreateOrder } = require('../validators/order.validator');
const { validateCreateBulkOrder } = require('../validators/bulkOrder.validator');

const router = Router();

// All cart routes require authentication
router.use(authMiddleware);
router.use(requireCustomerEmailVerified);
router.use(authLimiter);

router.post('/bulk', validateCreateBulkOrder, cartController.addBulkToCart);
router.patch('/bulk/:id', validateCreateBulkOrder, cartController.updateBulkCartEntry);
router.delete('/bulk/:id', cartController.removeBulkCartEntry);
router.post('/', validateCreateOrder, cartController.addToCart);
router.get('/', cartController.getCart);
router.patch('/:id', validateCreateOrder, cartController.updateCartItem);
router.delete('/:id', cartController.removeCartItem);
router.delete('/', cartController.clearCart);
router.post('/checkout', cartController.checkout);
router.post('/checkout/:id', cartController.checkoutSingleItem);

module.exports = router;
