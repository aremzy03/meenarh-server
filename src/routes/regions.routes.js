const { Router } = require('express');
const regionsController = require('../controllers/regions.public.controller');
const { validateDeliveriesQuery, validateDeliveryAreasQuery } = require('../validators/regions.validator');

const router = Router();

router.get('/pickups', regionsController.listPickups);
router.get('/deliveries', validateDeliveriesQuery, regionsController.listDeliveries);
router.get('/delivery-areas', validateDeliveryAreasQuery, regionsController.listDeliveryAreas);

module.exports = router;
