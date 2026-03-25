const orderService = require('../services/order.service');
const { sendTemplateMessage } = require('../services/whatsapp.service');
const pool = require('../config/db');

async function createOrder(req, res, next) {
  try {
    const userId = req.user.id;
    const result = await orderService.createOrder(req.body, userId);

    // Send WhatsApp order confirmation (non-blocking)
    try {
      const [customers] = await pool.execute(
        'SELECT phone, name FROM customers WHERE id = ?',
        [userId]
      );
      const customer = customers[0];

      if (customer && customer.phone) {
        sendTemplateMessage({
          to: customer.phone,
          templateName: 'order_confirmation',
          languageCode: 'en',
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: customer.name || 'there' },
                { type: 'text', text: result.trackingNumber },
                { type: 'text', text: String(result.price ?? '') },
              ],
            },
          ],
        });
      }
    } catch (notifyErr) {
      // eslint-disable-next-line no-console
      console.error('[OrderController] Failed to send WhatsApp order confirmation', notifyErr);
    }
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
