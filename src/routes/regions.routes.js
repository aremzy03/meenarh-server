const { Router } = require('express');
const regionsController = require('../controllers/regions.public.controller');
const { validateDeliveriesQuery } = require('../validators/regions.validator');

const router = Router();

router.get('/pickups', regionsController.listPickups);
router.get('/deliveries', validateDeliveriesQuery, regionsController.listDeliveries);

module.exports = router;
