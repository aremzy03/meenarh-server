const regionPricing = require('../services/regionPricing.service');

async function quote(req, res, next) {
  try {
    const { pickup_region_id: pickupId, delivery_region_id: deliveryId } = req.quoteQuery;
    const row = await regionPricing.getActiveRate(pickupId, deliveryId);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'No active rate for this pickup and delivery combination',
      });
    }
    res.json({
      success: true,
      data: {
        price_ngn: row.price_ngn,
        eta_min_hours: row.eta_min_hours,
        eta_max_hours: row.eta_max_hours,
        eta_label: row.eta_label,
        eta_display: row.eta_display,
        pickup_name: row.pickup_name,
        delivery_name: row.delivery_name,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { quote };
