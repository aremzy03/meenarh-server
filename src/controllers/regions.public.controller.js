const regionPricing = require('../services/regionPricing.service');

async function listPickups(_req, res, next) {
  try {
    const data = await regionPricing.listActivePickups();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listDeliveries(req, res, next) {
  try {
    const { pickup_region_id: pickupId } = req.regionQuery;
    const data = await regionPricing.listDeliveriesForPickup(pickupId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listDeliveryAreas(req, res, next) {
  try {
    const { delivery_region_id: deliveryId } = req.deliveryAreasQuery;
    const data = await regionPricing.listActiveDeliveryAreas(deliveryId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

module.exports = { listPickups, listDeliveries, listDeliveryAreas };
