const regionPricing = require('../services/regionPricing.service');

async function listPickups(_req, res, next) {
  try {
    const data = await regionPricing.listAllPickupsForAdmin();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createPickup(req, res, next) {
  try {
    const id = await regionPricing.createPickup(req.body);
    res.status(201).json({ success: true, data: { id } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Duplicate entry' });
    }
    next(err);
  }
}

async function updatePickup(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const ok = await regionPricing.updatePickup(id, req.body);
    if (!ok) return res.status(404).json({ success: false, message: 'Not found or no changes' });
    res.json({ success: true, message: 'Updated' });
  } catch (err) {
    next(err);
  }
}

async function deletePickup(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const ok = await regionPricing.deletePickup(id);
    if (!ok) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    next(err);
  }
}

async function listDeliveries(_req, res, next) {
  try {
    const data = await regionPricing.listAllDeliveriesForAdmin();
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createDelivery(req, res, next) {
  try {
    const id = await regionPricing.createDelivery(req.body);
    res.status(201).json({ success: true, data: { id } });
  } catch (err) {
    next(err);
  }
}

async function updateDelivery(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const ok = await regionPricing.updateDelivery(id, req.body);
    if (!ok) return res.status(404).json({ success: false, message: 'Not found or no changes' });
    res.json({ success: true, message: 'Updated' });
  } catch (err) {
    next(err);
  }
}

async function deleteDelivery(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const ok = await regionPricing.deleteDelivery(id);
    if (!ok) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    next(err);
  }
}

async function listRates(req, res, next) {
  try {
    const pickupId = req.query.pickup_region_id;
    const data = await regionPricing.listRatesForAdmin(pickupId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createRate(req, res, next) {
  try {
    const id = await regionPricing.createRate(req.body);
    res.status(201).json({ success: true, data: { id } });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'A rate for this pickup and delivery already exists' });
    }
    next(err);
  }
}

async function updateRate(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const ok = await regionPricing.updateRate(id, req.body);
    if (!ok) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Updated' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Duplicate pickup/delivery pair' });
    }
    next(err);
  }
}

async function deleteRate(req, res, next) {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ success: false, message: 'Invalid id' });
    }
    const ok = await regionPricing.deleteRate(id);
    if (!ok) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listPickups,
  createPickup,
  updatePickup,
  deletePickup,
  listDeliveries,
  createDelivery,
  updateDelivery,
  deleteDelivery,
  listRates,
  createRate,
  updateRate,
  deleteRate,
};
