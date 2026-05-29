const { Resend } = require('resend');

const { RESEND_API_KEY, EMAIL_FROM } = process.env;

if (!RESEND_API_KEY || !EMAIL_FROM) {
  // eslint-disable-next-line no-console
  console.warn(
    '[EmailService] Missing RESEND_API_KEY or EMAIL_FROM. Email notifications will be disabled.'
  );
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

// Brand tokens mirrored from meenarh-web/app/globals.css so emails feel native to the product.
// Inline hex literals are required because most email clients (Gmail, Outlook) strip <style> blocks
// and do not honour CSS custom properties.
const BRAND = {
  fontStack: "Montserrat, 'Helvetica Neue', Arial, sans-serif",
  canvas: '#f0f4e6',      // --secondary (page surround)
  card: '#f9faf4',         // --background (card surface)
  foreground: '#2d3512',   // --foreground (primary copy)
  muted: '#5e6645',        // --muted-foreground (secondary copy)
  border: '#d8e0c8',       // --border
  accent: '#e0e9cf',       // --accent (highlight surfaces)
  accentFg: '#33691e',     // --chart-3 (deep olive for accent text)
  primary: '#5c8d1d',      // --primary (CTAs, brand mark)
  primaryFg: '#ffffff',    // --primary-foreground
  destructiveBg: '#fce5e6',
  destructiveFg: '#9e2a2b',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatStatus(status) {
  return String(status || '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadgeStyle(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('deliver')) return { bg: BRAND.accent, fg: BRAND.accentFg };
  if (s.includes('cancel') || s.includes('fail')) return { bg: BRAND.destructiveBg, fg: BRAND.destructiveFg };
  if (s.includes('transit') || s.includes('out for') || s.includes('shipped')) return { bg: '#dfeec0', fg: '#558b2f' };
  return { bg: '#ebefe0', fg: BRAND.muted };
}

function brandHeaderHtml() {
  // SVG/PNG remote images are inconsistent across email clients (Gmail proxies, Outlook may strip).
  // A small CSS-styled olive square + wordmark is bulletproof and stays on-brand.
  return `<tr>
    <td style="padding:28px 32px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="vertical-align:middle;padding-right:10px;">
            <div style="width:28px;height:28px;background:${BRAND.primary};border-radius:6px;line-height:28px;text-align:center;color:${BRAND.primaryFg};font-family:${BRAND.fontStack};font-weight:700;font-size:15px;">M</div>
          </td>
          <td style="vertical-align:middle;font-family:${BRAND.fontStack};font-size:17px;font-weight:600;color:${BRAND.foreground};letter-spacing:-0.01em;">
            Meenarh Logistics
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

function wrapHtml({ preheader, title, intro, contentHtml, footerHtml }) {
  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;font-size:1px;line-height:1px;color:${BRAND.canvas};opacity:0;">${escapeHtml(preheader)}</div>`
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <meta name="supported-color-schemes" content="light" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BRAND.canvas};font-family:${BRAND.fontStack};color:${BRAND.foreground};-webkit-font-smoothing:antialiased;">
    ${preheaderHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.canvas};padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:${BRAND.card};border:1px solid ${BRAND.border};border-radius:12px;">
            ${brandHeaderHtml()}
            <tr>
              <td style="padding:24px 32px 8px;font-family:${BRAND.fontStack};">
                <h1 style="margin:0 0 12px;font-family:${BRAND.fontStack};font-size:22px;font-weight:600;color:${BRAND.foreground};letter-spacing:-0.01em;line-height:1.3;">${escapeHtml(title)}</h1>
                <p style="margin:0 0 20px;font-family:${BRAND.fontStack};font-size:15px;line-height:1.55;color:${BRAND.muted};">${intro}</p>
                ${contentHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 28px;">
                <p style="margin:24px 0 0;padding-top:20px;border-top:1px solid ${BRAND.border};font-family:${BRAND.fontStack};font-size:13px;line-height:1.55;color:${BRAND.muted};">${footerHtml || 'If you did not expect this email, you can safely ignore it.'}</p>
                <p style="margin:14px 0 0;font-family:${BRAND.fontStack};font-size:12px;color:${BRAND.muted};">© ${new Date().getFullYear()} Meenarh Logistics · Lagos, Nigeria</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function detailRowHtml({ label, value, isFirst }) {
  const borderTop = isFirst ? 'none' : `1px solid ${BRAND.border}`;
  return `<tr>
    <td style="padding:10px 0;border-top:${borderTop};font-family:${BRAND.fontStack};font-size:14px;color:${BRAND.muted};">${escapeHtml(label)}</td>
    <td style="padding:10px 0;border-top:${borderTop};font-family:${BRAND.fontStack};font-size:14px;color:${BRAND.foreground};font-weight:600;text-align:right;">${value}</td>
  </tr>`;
}

async function sendEmail({ to, subject, html, text, idempotencyKey }) {
  if (!resend || !EMAIL_FROM) return;
  if (!to) return;

  const payload = {
    from: EMAIL_FROM,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };
  if (text) payload.text = text;

  const options = idempotencyKey ? { idempotencyKey } : undefined;

  try {
    const { data, error } = await resend.emails.send(payload, options);
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[EmailService] Resend returned error', {
        subject,
        to,
        error,
      });
      return;
    }
    return data;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[EmailService] Failed to send email', {
      subject,
      to,
      message: err.message,
    });
  }
}

async function sendOrderConfirmationEmail({ to, name, trackingNumber, price, orderId }) {
  const safeName = escapeHtml(name || 'there');
  const safeTracking = escapeHtml(trackingNumber);
  const safePrice = escapeHtml(price ?? '');

  const contentHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0 0;">
      ${detailRowHtml({ label: 'Tracking number', value: safeTracking, isFirst: true })}
      ${detailRowHtml({ label: 'Price', value: `&#8358;${safePrice}` })}
    </table>
    <p style="margin:20px 0 0;font-family:${BRAND.fontStack};font-size:14px;line-height:1.55;color:${BRAND.foreground};">We will notify you the moment your order status changes.</p>
  `;

  const html = wrapHtml({
    preheader: `Tracking ${trackingNumber} · ₦${price ?? ''}`,
    title: 'Order confirmed',
    intro: `Hi ${safeName}, your Meenarh Logistics order is confirmed.`,
    contentHtml,
    footerHtml: 'Need help? Reply to this email and our team will get back to you.',
  });

  const text = `Hi ${name || 'there'}, your Meenarh Logistics order is confirmed.\nTracking number: ${trackingNumber}\nPrice: NGN ${price ?? ''}\n\nWe will notify you when your order status changes.`;

  return sendEmail({
    to,
    subject: `Order confirmed — ${trackingNumber}`,
    html,
    text,
    idempotencyKey: orderId ? `order-confirmation/${orderId}` : undefined,
  });
}

async function sendOrderStatusUpdateEmail({ to, name, trackingNumber, status, note, orderId, updatedAt }) {
  const safeName = escapeHtml(name || 'there');
  const safeTracking = escapeHtml(trackingNumber);
  const prettyStatus = formatStatus(status);
  const safeStatus = escapeHtml(prettyStatus);
  const safeNote = note ? escapeHtml(note) : '';
  const badge = statusBadgeStyle(status);

  const statusValueHtml = `<span style="display:inline-block;padding:4px 10px;border-radius:9999px;background:${badge.bg};color:${badge.fg};font-family:${BRAND.fontStack};font-size:12px;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;">${safeStatus}</span>`;

  const contentHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0 0;">
      ${detailRowHtml({ label: 'Tracking number', value: safeTracking, isFirst: true })}
      ${detailRowHtml({ label: 'Status', value: statusValueHtml })}
      ${safeNote ? detailRowHtml({ label: 'Note', value: `<span style="font-weight:400;color:${BRAND.foreground};">${safeNote}</span>` }) : ''}
    </table>
  `;

  const html = wrapHtml({
    preheader: `Tracking ${trackingNumber} is now ${prettyStatus}`,
    title: 'Order update',
    intro: `Hi ${safeName}, here is an update on your Meenarh Logistics delivery.`,
    contentHtml,
  });

  const text = `Hi ${name || 'there'}, update from Meenarh Logistics:\nTracking number: ${trackingNumber}\nStatus: ${prettyStatus}${note ? `\nNote: ${note}` : ''}`;

  // Include updatedAt epoch in the idempotency key so each genuine status change is a distinct send;
  // retries of the same event within 24h are de-duplicated by Resend.
  const idempotencyKey =
    orderId && updatedAt
      ? `order-status/${orderId}/${new Date(updatedAt).getTime()}`
      : undefined;

  return sendEmail({
    to,
    subject: `Order ${prettyStatus} — ${trackingNumber}`,
    html,
    text,
    idempotencyKey,
  });
}

async function sendPasswordResetEmail({ to, name, code, userId }) {
  const safeName = escapeHtml(name || 'there');
  const safeCode = escapeHtml(code);

  const contentHtml = `
    <div style="margin:16px 0 4px;padding:20px;border-radius:10px;background:${BRAND.accent};text-align:center;">
      <div style="font-family:'Source Code Pro','Courier New',monospace;font-size:30px;letter-spacing:8px;font-weight:700;color:${BRAND.foreground};">${safeCode}</div>
    </div>
    <p style="margin:12px 0 0;font-family:${BRAND.fontStack};font-size:13px;color:${BRAND.muted};">This code expires in 10 minutes.</p>
  `;

  const html = wrapHtml({
    preheader: 'Password reset code inside · expires in 10 minutes',
    title: 'Password reset code',
    intro: `Hi ${safeName}, use the code below to reset your Meenarh Logistics password.`,
    contentHtml,
    footerHtml: 'If you did not request a password reset, you can safely ignore this email.',
  });

  const text = `Your Meenarh Logistics password reset code is ${code}. It expires in 10 minutes. If you did not request this, ignore this message.`;

  return sendEmail({
    to,
    subject: 'Your Meenarh Logistics password reset code',
    html,
    text,
    idempotencyKey: userId ? `password-reset/${userId}/${code}` : undefined,
  });
}

async function sendAdminNewOrderEmail({
  to,
  orderKind,
  trackingNumber,
  status,
  price,
  customerName,
  customerEmail,
  adminUrl,
  orderId,
  itemCount,
}) {
  const prettyStatus = formatStatus(status);
  const safeTracking = escapeHtml(trackingNumber);
  const safePrice = escapeHtml(price ?? '');
  const safeCustomerName = escapeHtml(customerName || 'Customer');
  const safeCustomerEmail = escapeHtml(customerEmail || '—');
  const safeOrderKind = escapeHtml(orderKind === 'bulk' ? 'Bulk' : 'Single');
  const badge = statusBadgeStyle(status);
  const safeUrl = escapeHtml(adminUrl || '');

  const statusValueHtml = `<span style="display:inline-block;padding:4px 10px;border-radius:9999px;background:${badge.bg};color:${badge.fg};font-family:${BRAND.fontStack};font-size:12px;font-weight:600;letter-spacing:0.02em;text-transform:uppercase;">${escapeHtml(prettyStatus)}</span>`;

  const itemCountRow =
    orderKind === 'bulk' && itemCount != null
      ? detailRowHtml({ label: 'Items', value: escapeHtml(String(itemCount)) })
      : '';

  const ctaHtml = adminUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 0;">
      <tr>
        <td style="border-radius:8px;background:${BRAND.primary};">
          <a href="${safeUrl}" style="display:inline-block;padding:13px 22px;font-family:${BRAND.fontStack};font-size:15px;font-weight:600;color:${BRAND.primaryFg};text-decoration:none;border-radius:8px;">View in admin</a>
        </td>
      </tr>
    </table>`
    : '';

  const contentHtml = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:8px 0 0;">
      ${detailRowHtml({ label: 'Order type', value: safeOrderKind, isFirst: true })}
      ${detailRowHtml({ label: 'Tracking number', value: safeTracking })}
      ${detailRowHtml({ label: 'Status', value: statusValueHtml })}
      ${detailRowHtml({ label: 'Price', value: `&#8358;${safePrice}` })}
      ${itemCountRow}
      ${detailRowHtml({ label: 'Customer', value: `${safeCustomerName}<br/><span style="font-weight:400;color:${BRAND.muted};">${safeCustomerEmail}</span>` })}
    </table>
    ${ctaHtml}
  `;

  const textItemLine =
    orderKind === 'bulk' && itemCount != null ? `\nItems: ${itemCount}` : '';

  const html = wrapHtml({
    preheader: `New ${orderKind === 'bulk' ? 'bulk ' : ''}order ${trackingNumber} · ${prettyStatus}`,
    title: 'New order placed',
    intro: 'A customer has placed a new order on Meenarh Logistics.',
    contentHtml,
    footerHtml: 'You are receiving this because you are an admin or staff user.',
  });

  const text = `New order placed on Meenarh Logistics.\nOrder type: ${orderKind === 'bulk' ? 'Bulk' : 'Single'}\nTracking number: ${trackingNumber}\nStatus: ${prettyStatus}\nPrice: NGN ${price ?? ''}${textItemLine}\nCustomer: ${customerName || 'Customer'} (${customerEmail || '—'})${adminUrl ? `\n\nView in admin: ${adminUrl}` : ''}`;

  const idempotencyPrefix = orderKind === 'bulk' ? 'admin-new-order/bulk' : 'admin-new-order/single';

  return sendEmail({
    to,
    subject: `New order — ${trackingNumber} (${prettyStatus})`,
    html,
    text,
    idempotencyKey: orderId ? `${idempotencyPrefix}/${orderId}` : undefined,
  });
}

async function sendEmailVerificationEmail({ to, name, verificationUrl, userId }) {
  const safeName = escapeHtml(name || 'there');
  const safeUrl = escapeHtml(verificationUrl);

  const contentHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 4px;">
      <tr>
        <td style="border-radius:8px;background:${BRAND.primary};">
          <a href="${safeUrl}" style="display:inline-block;padding:13px 22px;font-family:${BRAND.fontStack};font-size:15px;font-weight:600;color:${BRAND.primaryFg};text-decoration:none;border-radius:8px;">Verify email</a>
        </td>
      </tr>
    </table>
    <p style="margin:18px 0 0;font-family:${BRAND.fontStack};font-size:13px;color:${BRAND.muted};">Or paste this link into your browser:</p>
    <p style="margin:6px 0 0;font-family:'Source Code Pro','Courier New',monospace;font-size:12px;color:${BRAND.foreground};word-break:break-all;">${safeUrl}</p>
    <p style="margin:18px 0 0;font-family:${BRAND.fontStack};font-size:13px;color:${BRAND.muted};">This link expires in 24 hours.</p>
  `;

  const html = wrapHtml({
    preheader: 'Confirm your email to finish setting up your Meenarh Logistics account',
    title: 'Verify your email',
    intro: `Hi ${safeName}, please confirm your email address to finish setting up your Meenarh Logistics account.`,
    contentHtml,
    footerHtml: 'If you did not create an account with Meenarh Logistics, you can safely ignore this email.',
  });

  const text = `Hi ${name || 'there'}, verify your Meenarh Logistics email by visiting:\n${verificationUrl}\n\nThis link expires in 24 hours.`;

  return sendEmail({
    to,
    subject: 'Verify your Meenarh Logistics email',
    html,
    text,
    idempotencyKey: userId ? `email-verification/${userId}` : undefined,
  });
}

module.exports = {
  sendEmail,
  sendOrderConfirmationEmail,
  sendOrderStatusUpdateEmail,
  sendAdminNewOrderEmail,
  sendPasswordResetEmail,
  sendEmailVerificationEmail,
};
