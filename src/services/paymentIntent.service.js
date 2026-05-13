const crypto = require('crypto');
const pool = require('../config/db');
const cartService = require('./cart.service');
const promoService = require('./promo.service');
const paystack = require('./paystack.service');
const bulkOrderService = require('./bulkOrder.service');
const { createBulkOrderSchema } = require('../validators/bulkOrder.validator');

const MAX_PAID_WAIT_MS = 20000;
const PAID_POLL_MS = 300;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function makeReference() {
  return `MN-${crypto.randomBytes(16).toString('hex')}`;
}

let warnedCallbackUrlFallback = false;

/**
 * Origin of the Next.js app (callback after Paystack). Read from the **API** process env
 * (meenarh-server/.env) — variables only in meenarh-web/.env are not available here.
 */
function publicCallbackBase() {
  const base =
    process.env.APP_PUBLIC_URL ||
    process.env.CLIENT_APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.FRONTEND_URL;

  if (base) {
    return base.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    const err = new Error(
      'Set APP_PUBLIC_URL in the API server environment (meenarh-server/.env) to your live site origin, e.g. https://app.example.com — Paystack needs this for callback_url. The Express server does not load Next.js env files.'
    );
    err.statusCode = 500;
    throw err;
  }

  const fallback = 'http://localhost:3000';
  if (!warnedCallbackUrlFallback) {
    warnedCallbackUrlFallback = true;
    // eslint-disable-next-line no-console
    console.warn(
      `[payments] APP_PUBLIC_URL is unset; using ${fallback} for Paystack callback_url. Add APP_PUBLIC_URL to meenarh-server/.env if the web app runs on another host or port.`
    );
  }
  return fallback;
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

function formatCheckoutPayload(orders, extra = {}) {
  const list = Array.isArray(orders) ? orders : [orders];
  return {
    orders: list.map((o) => ({
      tracking_number: o.trackingNumber,
      price: Number(o.price || 0),
    })),
    entries: list.map((o) => ({
      kind: o.kind || 'single',
      tracking_number: o.trackingNumber,
      price: Number(o.price || 0),
      ...(o.bulkItemCount != null ? { bulk_item_count: o.bulkItemCount } : {}),
    })),
    total_orders: list.length,
    total_price: list.reduce((s, o) => s + Number(o.price || 0), 0),
    ...extra,
  };
}

/**
 * Format the verify response for a completed bulk order.
 * Returns the same shape as cart checkout (one entry) so existing web code works.
 */
function formatBulkCheckoutPayload(result) {
  return formatCheckoutPayload(
    [{ kind: 'bulk', trackingNumber: result.trackingNumber, price: result.totalPrice, bulkItemCount: result.itemCount }],
    {
      checkout_kind: 'bulk',
      bulk_item_count: result.itemCount,
    }
  );
}

function formatMixedCheckoutPayload(result) {
  const checkoutKind = result.hasSingle && result.hasBulk
    ? 'mixed'
    : result.hasBulk
      ? 'bulk'
      : 'cart';

  const extra = {
    checkout_kind: checkoutKind,
    total_delivery_count: result.totalDeliveries,
  };

  if (checkoutKind === 'bulk' && result.entries.length === 1 && result.entries[0].bulkItemCount != null) {
    extra.bulk_item_count = result.entries[0].bulkItemCount;
  }

  return formatCheckoutPayload(result.entries, extra);
}

// ─── Cart / single-item helpers ───────────────────────────────────────────────

async function computePayable(userId, { scope, cart_item_id: cartItemId, promo_code: promoCodeRaw }) {
  if (scope === 'single_item') {
    const items = await cartService.getSingleCartItems(userId);
    if (!cartItemId) {
      const err = new Error('cart_item_id is required for single_item checkout');
      err.statusCode = 400;
      throw err;
    }
    const selectedItems = items.filter((i) => Number(i.id) === Number(cartItemId));
    if (!selectedItems.length) {
      const err = new Error('Cart item not found');
      err.statusCode = 404;
      throw err;
    }

    const subtotal = selectedItems.reduce((sum, item) => sum + (Number(item.estimated_price) || 0), 0);
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
      cart_item_id: Number(cartItemId),
      promo_code: promoCode ? promoCode.toUpperCase() : null,
      metadataForIntent: {
        subtotal,
        amount_ngn: amountNgn,
        ...(promoMeta || {}),
        scope,
        cart_item_id: Number(cartItemId),
      },
    };
  }

  const snapshot = await cartService.getCheckoutSnapshot(userId);
  if (!snapshot.singleItems.length && !snapshot.bulkEntries.length) {
    const err = new Error('Cart is empty');
    err.statusCode = 400;
    throw err;
  }

  const subtotal = Number(snapshot.subtotal || 0);
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
    cart_item_id: null,
    promo_code: promoCode ? promoCode.toUpperCase() : null,
    metadataForIntent: {
      checkout_snapshot_version: 1,
      subtotal,
      amount_ngn: amountNgn,
      total_delivery_count: snapshot.totalDeliveries,
      single_items: snapshot.singleItems,
      bulk_entries: snapshot.bulkEntries,
      ...(promoMeta || {}),
      scope,
      cart_item_id: null,
    },
  };
}

// ─── Bulk-order helpers ───────────────────────────────────────────────────────

/**
 * Validate the bulk payload, resolve region rates, and return pricing + metadata
 * ready to be stored in the payment_intent row. No DB writes.
 */
async function computePayableBulk(userId, body) {
  const {
    scope: _scope,
    cart_bulk_entry_id: cartBulkEntryId,
    promo_code: promoCodeRaw,
    ...bulkPayload
  } = body || {};

  let metadataForIntent;
  let subtotal;

  if (cartBulkEntryId != null) {
    const snapshot = await cartService.getBulkCheckoutSnapshot(cartBulkEntryId, userId);
    subtotal = Number(snapshot.amount_ngn || 0);
    metadataForIntent = {
      bulk_snapshot_version: 1,
      cart_bulk_entry_id: Number(cartBulkEntryId),
      sender_name: snapshot.senderName,
      sender_phone: snapshot.senderPhone,
      pickup_address: snapshot.defaultPickup,
      resolved_items: snapshot.resolvedItems,
      subtotal,
      amount_ngn: subtotal,
    };
  } else {
    const parsed = createBulkOrderSchema.safeParse(bulkPayload);
    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => {
        const path = i.path.length ? `[${i.path.join('.')}] ` : '';
        return `${path}${i.message}`;
      });
      const err = new Error(`Validation failed: ${messages.join('; ')}`);
      err.statusCode = 400;
      throw err;
    }

    const resolved = await bulkOrderService.resolveBulkOrderPayload(parsed.data, userId);
    subtotal = resolved.totalPrice;
    metadataForIntent = {
      bulk_snapshot_version: 1,
      sender_name: resolved.senderName,
      sender_phone: resolved.senderPhone,
      pickup_address: resolved.defaultPickup,
      resolved_items: resolved.resolvedItems,
      subtotal,
      amount_ngn: subtotal,
    };
  }

  const promoCode = promoCodeRaw && String(promoCodeRaw).trim() ? String(promoCodeRaw).trim() : null;
  let amountNgn = subtotal;
  let promoMeta = null;

  if (promoCode) {
    const validation = await promoService.validatePromoCode(promoCode, subtotal);
    if (!validation.valid) {
      const err = new Error(validation.message || 'Invalid promo code');
      err.statusCode = 400;
      throw err;
    }
    amountNgn = validation.new_total;
    promoMeta = {
      promo_code_id: validation.promo_code_id,
      promo_code: promoCode.toUpperCase(),
      discount: validation.discount,
    };
    metadataForIntent = {
      ...metadataForIntent,
      ...promoMeta,
      amount_ngn: amountNgn,
    };
  }

  const amountKobo = Math.round(amountNgn * 100);

  if (amountKobo < 100) {
    const err = new Error('Bulk order total is too small to charge');
    err.statusCode = 400;
    throw err;
  }

  return {
    amountKobo,
    amountNgn,
    subtotal,
    promoMeta,
    promo_code: promoCode ? promoCode.toUpperCase() : null,
    metadataForIntent,
  };
}

// ─── Core public API ─────────────────────────────────────────────────────────

async function initializePaystackForUser(userId, email, body) {
  const { scope } = body || {};
  if (!['full_cart', 'single_item', 'bulk_order'].includes(scope)) {
    const err = new Error('Invalid scope');
    err.statusCode = 400;
    throw err;
  }

  const reference = makeReference();
  const callbackUrl = `${publicCallbackBase()}/dashboard/payment/callback`;

  try {
    if (scope === 'bulk_order') {
      const bulk = await computePayableBulk(userId, body);

      await pool.execute(
        `INSERT INTO payment_intents
           (user_id, reference, amount_kobo, currency, status, scope, cart_item_id, promo_code, metadata)
         VALUES (?, ?, ?, 'NGN', 'pending', 'bulk_order', NULL, ?, ?)`,
        [userId, reference, bulk.amountKobo, bulk.promo_code, JSON.stringify(bulk.metadataForIntent)]
      );

      const init = await paystack.initializeTransaction({
        email,
        amountKobo: bulk.amountKobo,
        reference,
        callbackUrl,
        metadata: { user_id: userId, scope: 'bulk_order' },
      });

      const url = init?.data?.authorization_url;
      if (!url) throw new Error('Paystack did not return authorization_url');

      return { authorization_url: url, reference };
    }

    // ─ full_cart / single_item ─
    const { cart_item_id, promo_code } = body;
    const payable = await computePayable(userId, { scope, cart_item_id, promo_code });
    if (payable.amountKobo < 100) {
      const err = new Error('Amount too small to charge');
      err.statusCode = 400;
      throw err;
    }

    await pool.execute(
      `INSERT INTO payment_intents
         (user_id, reference, amount_kobo, currency, status, scope, cart_item_id, promo_code, metadata)
       VALUES (?, ?, ?, 'NGN', 'pending', ?, ?, ?, ?)`,
      [
        userId,
        reference,
        payable.amountKobo,
        payable.scope,
        payable.cart_item_id,
        payable.promo_code,
        JSON.stringify(payable.metadataForIntent),
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
    if (!url) throw new Error('Paystack did not return authorization_url');

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

async function fulfillMixedCartFromSnapshot(intent, meta) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await cartService.fulfillCheckoutSnapshot(conn, intent.user_id, {
      singleItems: meta.single_items || [],
      bulkEntries: meta.bulk_entries || [],
      totalDeliveries:
        meta.total_delivery_count ??
        ((meta.single_items || []).length +
          (meta.bulk_entries || []).reduce((sum, entry) => sum + (entry.resolvedItems || []).length, 0)),
    });
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
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
 * Verify with Paystack, fulfill once, idempotent by reference.
 * Handles full_cart, single_item, and bulk_order scopes.
 *
 * @param {string} reference
 * @param {{ userId?: number }} [opts]  If userId set (customer verify path), must match intent.
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

  let entityCreated = false;
  try {
    // ─── Bulk order branch ────────────────────────────────────────────────────
    if (intent.scope === 'bulk_order') {
      const snapshot = {
        senderName:    meta.sender_name,
        senderPhone:   meta.sender_phone,
        defaultPickup: meta.pickup_address,
        resolvedItems: meta.resolved_items,
        amount_ngn:    meta.amount_ngn,
      };

      if (!snapshot.resolvedItems || meta.bulk_snapshot_version !== 1) {
        const err = new Error('Bulk order snapshot is invalid or missing');
        err.statusCode = 500;
        throw err;
      }

      const conn = await pool.getConnection();
      let result;
      try {
        await conn.beginTransaction();
        result = await bulkOrderService.createBulkOrderFromSnapshot(intent.user_id, snapshot, conn);
        if (meta.cart_bulk_entry_id != null) {
          await cartService.clearDraftsInConnection(conn, intent.user_id, {
            bulkEntryIds: [Number(meta.cart_bulk_entry_id)],
          });
        }
        await conn.commit();
      } catch (error) {
        await conn.rollback();
        throw error;
      } finally {
        conn.release();
      }

      entityCreated = true;

      const checkoutPayload = formatBulkCheckoutPayload(result);
      await markFulfilled(reference, checkoutPayload);

      if (meta.promo_code_id && meta.discount != null) {
        await promoService.recordUsage({
          promoCodeId: meta.promo_code_id,
          customerId: intent.user_id,
          paymentIntentId: intent.id,
          discountApplied: meta.discount,
        });
      }

      // Best-effort notifications — do not await so fulfillment isn't blocked
      bulkOrderService.notifyBulkOrderPlaced(intent.user_id, {
        trackingNumber: result.trackingNumber,
        totalPrice: result.totalPrice,
      });

      return checkoutPayload;
    }

    // ─── Cart / single_item branch ────────────────────────────────────────────
    if (intent.scope === 'single_item') {
      const rawOrder = await cartService.checkoutSingleItem(intent.cart_item_id, intent.user_id);
      entityCreated = true;

      const checkoutPayload = formatCheckoutPayload(
        [{ kind: 'single', trackingNumber: rawOrder.trackingNumber, price: rawOrder.price }],
        { checkout_kind: 'cart' }
      );
      await markFulfilled(reference, checkoutPayload);

      if (meta.promo_code_id && meta.discount != null) {
        await promoService.recordUsage({
          promoCodeId: meta.promo_code_id,
          customerId: intent.user_id,
          orderId: rawOrder.orderId,
          paymentIntentId: intent.id,
          discountApplied: meta.discount,
        });
      }

      return checkoutPayload;
    }

    if (meta.checkout_snapshot_version === 1) {
      const mixedResult = await fulfillMixedCartFromSnapshot(intent, meta);
      entityCreated = true;

      const checkoutPayload = formatMixedCheckoutPayload(mixedResult);
      await markFulfilled(reference, checkoutPayload);

      if (meta.promo_code_id && meta.discount != null) {
        await promoService.recordUsage({
          promoCodeId: meta.promo_code_id,
          customerId: intent.user_id,
          paymentIntentId: intent.id,
          discountApplied: meta.discount,
        });
      }

      return checkoutPayload;
    }

    const rawOrders = await cartService.checkout(intent.user_id);
    entityCreated = true;

    const checkoutPayload = formatCheckoutPayload(rawOrders, { checkout_kind: 'cart' });
    await markFulfilled(reference, checkoutPayload);

    if (meta.promo_code_id && meta.discount != null) {
      await promoService.recordUsage({
        promoCodeId: meta.promo_code_id,
        customerId: intent.user_id,
        paymentIntentId: intent.id,
        discountApplied: meta.discount,
      });
    }

    return checkoutPayload;
  } catch (e) {
    if (!entityCreated) {
      await resetToPendingIfPaid(reference);
    }
    throw e;
  }
}

module.exports = {
  initializePaystackForUser,
  fulfillIntentByReference,
  computePayable,
  computePayableBulk,
};
