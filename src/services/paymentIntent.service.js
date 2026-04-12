const crypto = require('crypto');
const pool = require('../config/db');
const cartService = require('./cart.service');
const promoService = require('./promo.service');
const paystack = require('./paystack.service');

const MAX_PAID_WAIT_MS = 20000;
const PAID_POLL_MS = 300;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeReference() {
  return `MN-${crypto.randomBytes(16).toString('hex')}`;
}

function publicCallbackBase() {
  const base =
    process.env.APP_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.FRONTEND_URL;
  if (!base) {
    const err = new Error('APP_PUBLIC_URL (or NEXT_PUBLIC_APP_URL) is required for Paystack callbacks');
    err.statusCode = 500;
    throw err;
  }
  return base.replace(/\/$/, '');
}

function parseMetadata(row) {
  if (!row.metadata) return {};
  if (typeof row.metadata === 'string') {
    try {
      return JSON.parse(row.metadata);
    } catch {
      return {};
    }
  }
  return row.metadata;
}

function formatCheckoutPayload(orders) {
  const list = Array.isArray(orders) ? orders : [orders];
  return {
    orders: list.map((o) => ({
      tracking_number: o.trackingNumber,
      price: o.price,
    })),
    total_orders: list.length,
    total_price: list.reduce((s, o) => s + Number(o.price || 0), 0),
  };
}

async function computePayable(userId, { scope, cart_item_id: cartItemId, promo_code: promoCodeRaw }) {
  const items = await cartService.getCartItems(userId);
  if (!items.length) {
    const err = new Error('Cart is empty');
    err.statusCode = 400;
    throw err;
  }

  let subtotal = 0;
  let selectedItems = items;

  if (scope === 'single_item') {
    if (!cartItemId) {
      const err = new Error('cart_item_id is required for single_item checkout');
      err.statusCode = 400;
      throw err;
    }
    selectedItems = items.filter((i) => Number(i.id) === Number(cartItemId));
    if (!selectedItems.length) {
      const err = new Error('Cart item not found');
      err.statusCode = 404;
      throw err;
    }
  }

  for (const item of selectedItems) {
    subtotal += Number(item.estimated_price) || 0;
  }

  const promoCode = promoCodeRaw && String(promoCodeRaw).trim() ? String(promoCodeRaw).trim() : null;
  let discount = 0;
  let amountNgn = subtotal;
  let promoMeta = null;

  if (promoCode) {
    const validation = await promoService.validatePromoCode(promoCode, subtotal);
    if (!validation.valid) {
      const err = new Error(validation.message || 'Invalid promo code');
      err.statusCode = 400;
      throw err;
    }
    discount = validation.discount;
    amountNgn = validation.new_total;
    promoMeta = {
      promo_code_id: validation.promo_code_id,
      promo_code: promoCode.toUpperCase(),
      discount,
    };
  }

  const amountKobo = Math.round(Number(amountNgn) * 100);

  return {
    subtotal,
    amountNgn,
    amountKobo,
    promoMeta,
    scope,
    cart_item_id: scope === 'single_item' ? Number(cartItemId) : null,
    promo_code: promoCode ? promoCode.toUpperCase() : null,
  };
}

async function initializePaystackForUser(userId, email, body) {
  const { scope, cart_item_id, promo_code } = body || {};
  if (!['full_cart', 'single_item'].includes(scope)) {
    const err = new Error('Invalid scope');
    err.statusCode = 400;
    throw err;
  }

  const payable = await computePayable(userId, { scope, cart_item_id, promo_code });
  if (payable.amountKobo < 100) {
    const err = new Error('Amount too small to charge');
    err.statusCode = 400;
    throw err;
  }

  const reference = makeReference();
  const callbackUrl = `${publicCallbackBase()}/dashboard/payment/callback`;

  const metadata = {
    subtotal: payable.subtotal,
    amount_ngn: payable.amountNgn,
    ...(payable.promoMeta || {}),
    scope: payable.scope,
    cart_item_id: payable.cart_item_id,
  };

  try {
    await pool.execute(
      `INSERT INTO payment_intents (
        user_id, reference, amount_kobo, currency, status, scope, cart_item_id, promo_code, metadata
      ) VALUES (?, ?, ?, 'NGN', 'pending', ?, ?, ?, ?)`,
      [
        userId,
        reference,
        payable.amountKobo,
        payable.scope,
        payable.cart_item_id,
        payable.promo_code,
        JSON.stringify(metadata),
      ]
    );

    const init = await paystack.initializeTransaction({
      email,
      amountKobo: payable.amountKobo,
      reference,
      callbackUrl,
      metadata: { user_id: userId, scope: payable.scope },
    });

    const url = init?.data?.authorization_url;
    if (!url) {
      throw new Error('Paystack did not return authorization_url');
    }

    return { authorization_url: url, reference };
  } catch (e) {
    await pool.execute('DELETE FROM payment_intents WHERE reference = ?', [reference]).catch(() => {});
    throw e;
  }
}

async function acquirePaidSlot(reference) {
  const [r] = await pool.execute(
    `UPDATE payment_intents SET status = 'paid', updated_at = NOW() WHERE reference = ? AND status = 'pending'`,
    [reference]
  );
  return r.affectedRows === 1;
}

async function resetToPendingIfPaid(reference) {
  await pool.execute(
    `UPDATE payment_intents SET status = 'pending', updated_at = NOW() WHERE reference = ? AND status = 'paid'`,
    [reference]
  );
}

async function markFulfilled(reference, checkoutPayload) {
  const [rows] = await pool.execute('SELECT metadata FROM payment_intents WHERE reference = ?', [reference]);
  const meta = rows.length ? parseMetadata(rows[0]) : {};
  meta.checkoutResponse = checkoutPayload;
  const [r] = await pool.execute(
    `UPDATE payment_intents SET status = 'fulfilled', fulfilled_at = NOW(), metadata = ?, updated_at = NOW()
     WHERE reference = ? AND status = 'paid'`,
    [JSON.stringify(meta), reference]
  );
  if (r.affectedRows === 0) {
    const err = new Error('Failed to finalize payment record');
    err.statusCode = 500;
    throw err;
  }
}

async function getIntentRow(reference) {
  const [rows] = await pool.execute('SELECT * FROM payment_intents WHERE reference = ?', [reference]);
  return rows[0] || null;
}

async function waitForFulfilledCheckout(reference) {
  const start = Date.now();
  while (Date.now() - start < MAX_PAID_WAIT_MS) {
    const row = await getIntentRow(reference);
    if (!row) {
      const err = new Error('Payment intent not found');
      err.statusCode = 404;
      throw err;
    }
    if (row.status === 'fulfilled') {
      const meta = parseMetadata(row);
      if (meta.checkoutResponse) return meta.checkoutResponse;
    }
    await delay(PAID_POLL_MS);
  }
  const err = new Error('Payment is still being processed. Please try again shortly.');
  err.statusCode = 408;
  throw err;
}

/**
 * Verify with Paystack, fulfill cart once, idempotent by reference.
 * @param {string} reference
 * @param {{ userId?: number }} [opts] If userId set (customer verify), must match intent owner.
 */
async function fulfillIntentByReference(reference, opts = {}) {
  const { userId } = opts;
  const row = await getIntentRow(reference);
  if (!row) {
    const err = new Error('Payment intent not found');
    err.statusCode = 404;
    throw err;
  }
  if (userId != null && Number(row.user_id) !== Number(userId)) {
    const err = new Error('Forbidden');
    err.statusCode = 403;
    throw err;
  }

  if (row.status === 'fulfilled') {
    const meta = parseMetadata(row);
    if (meta.checkoutResponse) return meta.checkoutResponse;
  }

  const ps = await paystack.verifyTransaction(reference);
  const data = ps?.data;
  if (!data || data.status !== 'success') {
    const err = new Error('Paystack reports this payment was not successful');
    err.statusCode = 400;
    throw err;
  }
  if (Number(data.amount) !== Number(row.amount_kobo)) {
    const err = new Error('Payment amount does not match order total');
    err.statusCode = 400;
    throw err;
  }

  const acquired = await acquirePaidSlot(reference);
  if (!acquired) {
    const latest = await getIntentRow(reference);
    if (latest.status === 'fulfilled') {
      const meta = parseMetadata(latest);
      if (meta.checkoutResponse) return meta.checkoutResponse;
    }
    if (latest.status === 'paid') {
      return waitForFulfilledCheckout(reference);
    }
    const err = new Error('Unable to process payment for this reference');
    err.statusCode = 409;
    throw err;
  }

  const intent = await getIntentRow(reference);
  const meta = parseMetadata(intent);

  let ordersCreated = false;
  try {
    let rawOrders;
    if (intent.scope === 'single_item') {
      rawOrders = await cartService.checkoutSingleItem(intent.cart_item_id, intent.user_id);
    } else {
      rawOrders = await cartService.checkout(intent.user_id);
    }
    ordersCreated = true;

    const checkoutPayload = formatCheckoutPayload(rawOrders);

    await markFulfilled(reference, checkoutPayload);

    if (meta.promo_code_id && checkoutPayload.orders.length) {
      const first = Array.isArray(rawOrders) ? rawOrders[0] : rawOrders;
      const orderId = first?.orderId;
      if (orderId && meta.discount != null) {
        await promoService.recordUsage(meta.promo_code_id, intent.user_id, orderId, meta.discount);
      }
    }

    return checkoutPayload;
  } catch (e) {
    if (!ordersCreated) {
      await resetToPendingIfPaid(reference);
    }
    throw e;
  }
}

module.exports = {
  initializePaystackForUser,
  fulfillIntentByReference,
  computePayable,
};
