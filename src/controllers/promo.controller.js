const promoService = require('../services/promo.service');

async function createPromoCode(req, res, next) {
  try {
    const promo = await promoService.createPromoCode(req.body);
    res.status(201).json({ success: true, message: 'Promo code created successfully', data: promo });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Promo code already exists' });
    }
    next(err);
  }
}

async function getAllPromoCodes(_req, res, next) {
  try {
    const codes = await promoService.getAllPromoCodes();
    res.json({ success: true, data: codes });
  } catch (err) {
    next(err);
  }
}

async function getPromoCodeById(req, res, next) {
  try {
    const promo = await promoService.getPromoCodeById(req.params.id);
    if (!promo) {
      return res.status(404).json({ success: false, message: 'Promo code not found' });
    }
    res.json({ success: true, data: promo });
  } catch (err) {
    next(err);
  }
}

async function updatePromoCode(req, res, next) {
  try {
    const updated = await promoService.updatePromoCode(req.params.id, req.body);
    if (!updated) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }
    const promo = await promoService.getPromoCodeById(req.params.id);
    res.json({ success: true, message: 'Promo code updated successfully', data: promo });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Promo code already exists' });
    }
    next(err);
  }
}

async function togglePromoCode(req, res, next) {
  try {
    const isActive = await promoService.togglePromoCode(req.params.id);
    res.json({
      success: true,
      message: `Promo code ${isActive ? 'activated' : 'deactivated'}`,
      data: { is_active: isActive },
    });
  } catch (err) {
    next(err);
  }
}

async function deletePromoCode(req, res, next) {
  try {
    const deleted = await promoService.deletePromoCode(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Promo code not found' });
    }
    res.json({ success: true, message: 'Promo code deleted successfully' });
  } catch (err) {
    next(err);
  }
}

async function validateCode(req, res, next) {
  try {
    const { code, order_total } = req.body;
    const result = await promoService.validatePromoCode(code, order_total);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createPromoCode, getAllPromoCodes, getPromoCodeById,
  updatePromoCode, togglePromoCode, deletePromoCode, validateCode,
};
