const BASE = 'https://api.paystack.co';

function getSecret() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    const err = new Error('PAYSTACK_SECRET_KEY is not configured');
    err.statusCode = 500;
    throw err;
  }
  return key;
}

async function paystackFetch(path, options = {}) {
  const secret = getSecret();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message || `Paystack request failed (${res.status})`);
    err.statusCode = 502;
    err.paystackBody = body;
    throw err;
  }
  return body;
}

/**
 * @param {{ email: string, amountKobo: number, reference: string, callbackUrl: string, metadata?: Record<string, unknown> }} params
 */
async function initializeTransaction({ email, amountKobo, reference, callbackUrl, metadata }) {
  return paystackFetch('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email,
      amount: amountKobo,
      reference,
      callback_url: callbackUrl,
      metadata: metadata || undefined,
    }),
  });
}

async function verifyTransaction(reference) {
  return paystackFetch(`/transaction/verify/${encodeURIComponent(reference)}`, {
    method: 'GET',
  });
}

module.exports = {
  initializeTransaction,
  verifyTransaction,
};
