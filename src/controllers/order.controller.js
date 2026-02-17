const orderService = require('../services/order.service');

async function createOrder(req, res, next) {
  try {
    const userId = req.user.id;
    const result = await orderService.createOrder(req.body, userId);
    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        tracking_number: result.trackingNumber,
        price: result.price,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function trackOrder(req, res, next) {
  try {
    const { trackingNumber } = req.params;
    const order = await orderService.getOrderByTracking(trackingNumber);

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

module.exports = { createOrder, trackOrder };
