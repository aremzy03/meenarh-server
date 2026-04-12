const crypto = require('crypto');
const paymentIntentService = require('../services/paymentIntent.service');

function getSecret() {
  return process.env.PAYSTACK_SECRET_KEY || '';
}

/**
 * Express handler: req.body is Buffer (express.raw).
 */
async function handlePaystackWebhook(req, res) {
  const secret = getSecret();
  if (!secret) {
    return res.status(500).json({ success: false, message: 'Paystack not configured' });
  }

  const signature = req.headers['x-paystack-signature'];
  if (!signature || !(req.body instanceof Buffer)) {
    return res.status(400).json({ success: false, message: 'Invalid webhook payload' });
  }

  const hash = crypto.createHmac('sha512', secret).update(req.body).digest('hex');
  if (hash !== signature) {
    return res.status(400).json({ success: false, message: 'Invalid signature' });
  }

  let event;
  try {
    event = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).json({ success: false, message: 'Invalid JSON' });
  }

  if (event.event === 'charge.success') {
    const reference = event.data?.reference;
    if (reference) {
      try {
        await paymentIntentService.fulfillIntentByReference(reference);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Paystack webhook fulfill error:', err);
        return res.status(500).json({ success: false, message: 'Fulfillment failed' });
      }
    }
  }

  return res.sendStatus(200);
}

module.exports = { handlePaystackWebhook };
