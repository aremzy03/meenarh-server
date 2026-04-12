const { Router } = require('express');
const ctrl = require('../controllers/regionAdmin.controller');
const {
  validateCreatePickup,
  validateUpdatePickup,
  validateCreateDelivery,
  validateUpdateDelivery,
  validateCreateRate,
  validateUpdateRate,
} = require('../validators/regionAdmin.validator');

const router = Router();

router.get('/pickups', ctrl.listPickups);
router.post('/pickups', validateCreatePickup, ctrl.createPickup);
router.put('/pickups/:id', validateUpdatePickup, ctrl.updatePickup);
router.delete('/pickups/:id', ctrl.deletePickup);

router.get('/deliveries', ctrl.listDeliveries);
router.post('/deliveries', validateCreateDelivery, ctrl.createDelivery);
router.put('/deliveries/:id', validateUpdateDelivery, ctrl.updateDelivery);
router.delete('/deliveries/:id', ctrl.deleteDelivery);

router.get('/rates', ctrl.listRates);
router.post('/rates', validateCreateRate, ctrl.createRate);
router.put('/rates/:id', validateUpdateRate, ctrl.updateRate);
router.delete('/rates/:id', ctrl.deleteRate);

module.exports = router;
