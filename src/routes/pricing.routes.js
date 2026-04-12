const { Router } = require('express');
const pricingController = require('../controllers/pricing.public.controller');
const { validateQuoteQuery } = require('../validators/regions.validator');

const router = Router();

router.get('/quote', validateQuoteQuery, pricingController.quote);

module.exports = router;
