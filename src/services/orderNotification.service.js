const pool = require('../config/db');
const { sendAdminNewOrderEmail } = require('./email.service');

function adminBaseUrl() {
  return (process.env.ADMIN_BASE_URL || '').replace(/\/$/, '');
}

async function getAdminRecipientEmails() {
  const [rows] = await pool.execute(
    `SELECT email FROM users WHERE email IS NOT NULL AND email != ''`
  );
  return rows.map((row) => row.email).filter(Boolean);
}

async function loadCustomer(userId) {
  const [rows] = await pool.execute('SELECT name, email FROM customers WHERE id = ?', [userId]);
  return rows[0] || { name: 'Customer', email: null };
}

function fanOutToAdmins(sendFn) {
  getAdminRecipientEmails()
    .then((emails) => {
      for (const email of emails) {
        sendFn(email).catch(() => {});
      }
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[orderNotification.service] Failed to load admin recipients', err);
    });
}

async function notifyAdminsNewSingleOrder({
  orderId,
  trackingNumber,
  status,
  price,
  customerUserId,
}) {
  try {
    const customer = await loadCustomer(customerUserId);
    const base = adminBaseUrl();
    const adminUrl = base ? `${base}/admin/orders/${orderId}` : null;

    fanOutToAdmins((to) =>
      sendAdminNewOrderEmail({
        to,
        orderKind: 'single',
        trackingNumber,
        status,
        price,
        customerName: customer.name,
        customerEmail: customer.email,
        adminUrl,
        orderId,
      })
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[orderNotification.service] Failed to notify admins of single order', err);
  }
}

async function notifyAdminsNewBulkOrder({
  bulkOrderId,
  trackingNumber,
  status,
  price,
  itemCount,
  customerUserId,
}) {
  try {
    const customer = await loadCustomer(customerUserId);
    const base = adminBaseUrl();
    const adminUrl = base ? `${base}/admin/bulk-orders?highlight=${bulkOrderId}` : null;

    fanOutToAdmins((to) =>
      sendAdminNewOrderEmail({
        to,
        orderKind: 'bulk',
        trackingNumber,
        status,
        price,
        customerName: customer.name,
        customerEmail: customer.email,
        adminUrl,
        orderId: bulkOrderId,
        itemCount,
      })
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[orderNotification.service] Failed to notify admins of bulk order', err);
  }
}

async function notifyAdminsForPaystackReference(reference) {
  try {
    const [orderRows] = await pool.execute(
      `SELECT id, tracking_number, price, status, user_id
       FROM orders WHERE paystack_reference = ?`,
      [reference]
    );

    for (const row of orderRows) {
      notifyAdminsNewSingleOrder({
        orderId: row.id,
        trackingNumber: row.tracking_number,
        status: row.status,
        price: row.price,
        customerUserId: row.user_id,
      });
    }

    const [bulkRows] = await pool.execute(
      `SELECT b.id, b.tracking_number, b.price, b.status, b.user_id,
              (SELECT COUNT(*) FROM bulk_order_items WHERE bulk_order_id = b.id) AS item_count
       FROM bulk_orders b WHERE b.paystack_reference = ?`,
      [reference]
    );

    for (const row of bulkRows) {
      notifyAdminsNewBulkOrder({
        bulkOrderId: row.id,
        trackingNumber: row.tracking_number,
        status: row.status,
        price: row.price,
        itemCount: Number(row.item_count || 0),
        customerUserId: row.user_id,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[orderNotification.service] Failed to notify admins for Paystack reference', err);
  }
}

module.exports = {
  notifyAdminsNewSingleOrder,
  notifyAdminsNewBulkOrder,
  notifyAdminsForPaystackReference,
};
