const paymentIntentService = require('../services/paymentIntent.service');

async function initializePaystack(req, res, next) {
  try {
    const userId = req.user.id;
    const email = req.user.email;
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Customer email is required for payment. Please update your profile.',
      });
    }
    const data = await paymentIntentService.initializePaystackForUser(userId, email, req.body);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function verifyPaystack(req, res, next) {
  try {
    const reference = req.body?.reference;
    if (!reference || typeof reference !== 'string') {
      return res.status(400).json({ success: false, message: 'reference is required' });
    }
    const payload = await paymentIntentService.fulfillIntentByReference(reference, {
      userId: req.user.id,
    });
    res.json({
      success: true,
      message: 'Orders created successfully',
      data: payload,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  initializePaystack,
  verifyPaystack,
};
