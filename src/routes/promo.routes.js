const { Router } = require('express');
const promoController = require('../controllers/promo.controller');
const { validateCreatePromo, validateUpdatePromo, validatePromoCode } = require('../validators/promo.validator');

// Public route for validation at checkout (mounted at /api/promo-codes)
const publicRouter = Router();
publicRouter.post('/validate', validatePromoCode, promoController.validateCode);

// Admin routes (mounted under /api/admin/promo-codes, auth applied by parent)
const adminRouter = Router();
adminRouter.post('/', validateCreatePromo, promoController.createPromoCode);
adminRouter.get('/', promoController.getAllPromoCodes);
adminRouter.get('/:id', promoController.getPromoCodeById);
adminRouter.put('/:id', validateUpdatePromo, promoController.updatePromoCode);
adminRouter.patch('/:id/toggle', promoController.togglePromoCode);
adminRouter.delete('/:id', promoController.deletePromoCode);

module.exports = { publicRouter, adminRouter };
