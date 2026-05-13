# Resend Email Implementation

Companion document to [`WHATSAPP_POLICY_AND_TEMPLATES.md`](./WHATSAPP_POLICY_AND_TEMPLATES.md). Where WhatsApp owns approval-gated transactional alerts on phone, Resend owns transactional **email** for the same lifecycle events plus one email-only flow (verification link). Both channels fire in parallel from the same trigger points and are independently best-effort.

---

## 1. Channel role & scope

| Capability                       | WhatsApp                              | Resend (Email)                                |
| -------------------------------- | ------------------------------------- | --------------------------------------------- |
| Order confirmation               | ❌ (gap in legacy code)                | ✅ `sendOrderConfirmationEmail`                |
| Order status updates             | ✅ template `order_status_update`      | ✅ `sendOrderStatusUpdateEmail`                |
| Password reset code (OTP)        | ✅ template `password_reset_code`      | ✅ `sendPasswordResetEmail`                    |
| Phone verification code (OTP)    | ✅ template `phone_verification_code`  | ⛔ intentionally not duplicated on email      |
| Email verification (link)        | n/a                                   | ✅ `sendEmailVerificationEmail` (only channel) |

> **Design principle.** Email never blocks the HTTP response. Every send is fired without `await` from the controller, mirrors the WhatsApp service's non-blocking pattern, and silently no-ops when `RESEND_API_KEY` / `EMAIL_FROM` are unset.

---

## 2. Environment

Configured in [`.env.example`](./.env.example):

```bash
# Resend (https://resend.com)
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=Meenarh Logistics <noreply@your-verified-domain.com>

# Used to build the email-verification redirect chain.
API_PUBLIC_URL=https://api.your-domain.com
FRONTEND_BASE_URL=https://your-domain.com
```

| Variable           | Required for          | Notes                                                                                                                              |
| ------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`   | All emails            | Without it the service warns once at boot and every send is a silent no-op.                                                        |
| `EMAIL_FROM`       | All emails            | Must use a domain **verified in Resend**. `onboarding@resend.dev` works in dev but only delivers to the Resend account owner.       |
| `API_PUBLIC_URL`   | Email verification    | Used to build `${API_PUBLIC_URL}/api/user/verify-email?token=…`. If empty, signup still succeeds but no verification email is sent. |
| `FRONTEND_BASE_URL`| Email verification    | The verify endpoint 302-redirects here with `?email_verified=success|expired|invalid|error`.                                       |

---

## 3. Template inventory

All four templates live in one file: [`src/services/email.service.js`](./src/services/email.service.js).
Each function is the canonical "template name" — there are no external template assets to register in the Resend dashboard. HTML is composed in-process so the service ships as a single dependency-free module.

| # | Function (template name)        | Subject                                                | Trigger location                            | Idempotency key                                       |
| - | ------------------------------- | ------------------------------------------------------ | ------------------------------------------- | ----------------------------------------------------- |
| 1 | `sendOrderConfirmationEmail`    | `Order confirmed — {trackingNumber}`                   | `order.controller.js → createOrder`         | `order-confirmation/{orderId}`                        |
| 2 | `sendOrderStatusUpdateEmail`    | `Order {Status} — {trackingNumber}`                    | `admin.controller.js → updateOrderStatus`   | `order-status/{orderId}/{updatedAtEpoch}`             |
| 3 | `sendPasswordResetEmail`        | `Your Meenarh Logistics password reset code`           | `auth.routes.js → POST /forgot-password`    | `password-reset/{userId}/{code}`                      |
| 4 | `sendEmailVerificationEmail`    | `Verify your Meenarh Logistics email`                  | `user.controller.js → signup` + `requestEmailVerification` | `email-verification/{userId}`                |

**Idempotency model.** Resend deduplicates identical idempotency keys within a 24-hour window. The keys above are chosen so that:

- **Re-creations** of the same order do not send a second confirmation.
- **Every distinct status transition** generates a fresh key (epoch of `updated_at`), so customers always get the new state — but a retry of the same write does not double-send.
- **OTPs** are unique per user/code, so the same code never re-sends, but a fresh request (new code) always does.
- **Verification link** is keyed per user, deduplicating accidental rapid resubmits. The cooldown in `user.service.js` (60s) is the primary throttle; the idempotency key is the safety net.

Plain-text fallbacks are sent on every email so screen readers, spam filters, and minimal mail clients always have a clean version. This materially helps deliverability.

---

## 4. UI design system mapping

The HTML mirrors the tokens defined in [`meenarh-web/app/globals.css`](../meenarh-web/app/globals.css) so emails feel native to the product surface. Email clients (Gmail, Outlook) strip `<style>` blocks and don't honour CSS custom properties, so the tokens are inlined as hex literals via a single `BRAND` constant in [`email.service.js`](./src/services/email.service.js):

```js
const BRAND = {
  fontStack: "Montserrat, 'Helvetica Neue', Arial, sans-serif",
  canvas:        '#f0f4e6',   // --secondary
  card:          '#f9faf4',   // --background
  foreground:    '#2d3512',   // --foreground
  muted:         '#5e6645',   // --muted-foreground
  border:        '#d8e0c8',   // --border
  accent:        '#e0e9cf',   // --accent
  accentFg:      '#33691e',   // --chart-3
  primary:       '#5c8d1d',   // --primary
  primaryFg:     '#ffffff',   // --primary-foreground
  destructiveBg: '#fce5e6',
  destructiveFg: '#9e2a2b',   // --destructive
};
```

| Token             | Hex       | Web role                      | Email role                                       |
| ----------------- | --------- | ----------------------------- | ------------------------------------------------ |
| `--secondary`     | `#f0f4e6` | Soft surface, hover           | **Email canvas** (the page surround of the card) |
| `--background`    | `#f9faf4` | Page background, card surface | **Email card** (560 px content surface)          |
| `--foreground`    | `#2d3512` | Body text                     | Headings, value cells, code box numerals         |
| `--muted-foreground` | `#5e6645` | Subdued copy               | Intro paragraph, footer, table labels            |
| `--border`        | `#d8e0c8` | Card outline, dividers        | Card border, table row separators, footer rule   |
| `--accent`        | `#e0e9cf` | Highlight surfaces            | OTP code box, "delivered" status pill            |
| `--primary`       | `#5c8d1d` | CTA, brand mark               | Verify-email button, brand square mark           |
| `--destructive`   | `#9e2a2b` | Errors                        | "cancelled" / "failed" status pill text          |

**Typography.** Montserrat is requested first; email clients that don't honour custom fonts fall back through Helvetica Neue → Arial → generic sans, preserving the geometric-sans feel. Source Code Pro (mono) is requested for the OTP digits and the raw verification URL; clients fall back to Courier New. Display weight is `600` for titles, `400`/`600` mixed for body, matching the web's `font-semibold` heading pattern (`text-2xl font-semibold` on cards in `forgot-password/page.tsx`).

**Radius & elevation.** Card radius `12px` (slightly larger than the web's `rounded-xl` 0.75rem to feel intentional inside the constrained email canvas). No drop shadows — most email clients render them inconsistently or strip them entirely, so the card relies on a `1px solid #d8e0c8` outline + the cream-on-olive canvas contrast for elevation. This matches the flat, paper-like aesthetic of the web cards (which use the very subtle `--shadow-sm` only).

**Brand mark.** Embedded `<img>` tags for the SVG logo are unreliable across Gmail proxies and Outlook. The header instead renders a CSS-styled olive square containing the letter "M" alongside the "Meenarh Logistics" wordmark — bulletproof across every client and identical to the wordmark pattern in `forgot-password/page.tsx`:

```tsx
<Link href="/" className="flex items-center justify-center gap-2 mb-8">
  <Image src="/meenarh logo.svg" alt="Meenarh Logistics" width={40} height={40} className="w-10 h-10" />
  <span className="text-xl font-semibold text-foreground">Meenarh Logistics</span>
</Link>
```

Email equivalent:

```html
<div style="width:28px;height:28px;background:#5c8d1d;border-radius:6px;line-height:28px;
            text-align:center;color:#ffffff;font-family:Montserrat,...;font-weight:700;font-size:15px;">M</div>
<span style="font-family:Montserrat,...;font-size:17px;font-weight:600;color:#2d3512;">Meenarh Logistics</span>
```

---

## 5. The shared shell — `wrapHtml`

Every template is composed through one helper so the brand frame is locked in one place. Its signature:

```js
wrapHtml({
  preheader,    // String — shown in the inbox preview row, hidden inside the message body
  title,        // String — H1 inside the card (e.g. "Order confirmed")
  intro,        // HTML string — short opening paragraph in muted-foreground
  contentHtml,  // HTML string — the per-template body (detail table, OTP box, CTA, …)
  footerHtml,   // Optional HTML string — overrides the default "you can safely ignore" line
})
```

The wrapper produces:

```
┌──────────────────────────────────────────────────┐  ← #f0f4e6 canvas, 32px padding
│  ┌────────────────────────────────────────────┐  │
│  │ [M] Meenarh Logistics                       │  │  ← brand header (28px square + wordmark)
│  │                                             │  │
│  │ {title}                                     │  │  ← 22px / 600 / -0.01em tracking
│  │ {intro}                                     │  │  ← 15px / muted #5e6645 / 1.55 lh
│  │                                             │  │
│  │ {contentHtml}                               │  │  ← template-specific body
│  │                                             │  │
│  │ ────────────────────────────────────        │  │  ← #d8e0c8 1px divider
│  │ {footerHtml}                                │  │  ← 13px / muted
│  │ © {year} Meenarh Logistics · Lagos, Nigeria │  │  ← 12px / muted
│  └────────────────────────────────────────────┘  │  ← #f9faf4 card, 12px radius, #d8e0c8 border
└──────────────────────────────────────────────────┘
```

Boilerplate the wrapper handles for you so per-template code stays focused:

- Doctype + viewport meta + `color-scheme: light` (prevents Gmail/Outlook from inverting brand olive into something unreadable in dark mode).
- Hidden **preheader** for the inbox preview snippet (`display:none; max-height:0; opacity:0;`).
- Outer table-based centering at 560 px max-width (the canonical safe width for Outlook on Windows).
- HTML-escapes the `title` automatically — but `intro`, `contentHtml`, and `footerHtml` are HTML strings; per-template code must call `escapeHtml()` on user-supplied values it interpolates.

---

## 6. Per-template breakdown

### 6.1 Order confirmation — `sendOrderConfirmationEmail`

**Signature**

```js
sendOrderConfirmationEmail({ to, name, trackingNumber, price, orderId })
```

**Subject** `Order confirmed — {trackingNumber}`
**Preheader** `Tracking {trackingNumber} · ₦{price}`
**Fires from** `src/controllers/order.controller.js → createOrder` after `orderService.createOrder` resolves.

**Body anatomy**

- Title: `Order confirmed`
- Intro: `Hi {name}, your Meenarh Logistics order is confirmed.`
- Detail table (label / value rows separated by 1 px border):
  - Tracking number → `{trackingNumber}` (mono-feel, bold)
  - Price → `₦{price}`
- Follow-up paragraph: `We will notify you the moment your order status changes.`
- Footer override: `Need help? Reply to this email and our team will get back to you.`

### 6.2 Order status update — `sendOrderStatusUpdateEmail`

**Signature**

```js
sendOrderStatusUpdateEmail({ to, name, trackingNumber, status, note, orderId, updatedAt })
```

**Subject** `Order {Status} — {trackingNumber}` (Title-Cased)
**Preheader** `Tracking {trackingNumber} is now {Status}`
**Fires from** `src/controllers/admin.controller.js → updateOrderStatus`.

**Status pill** — semantic color cues without inventing colors outside the brand palette:

| Status contains      | Background  | Text color  |
| -------------------- | ----------- | ----------- |
| `deliver…`           | `#e0e9cf` (`--accent`)     | `#33691e` (`--chart-3`) |
| `cancel…` / `fail…`  | `#fce5e6` (destructive bg) | `#9e2a2b` (`--destructive`) |
| `transit` / `out for` / `shipped` | `#dfeec0` | `#558b2f` (`--chart-5`) |
| Anything else        | `#ebefe0` (`--muted`)      | `#5e6645` (`--muted-foreground`) |

Pills render as `border-radius:9999px`, uppercase, 12 px / 600 weight — the same shape language as the web's status chips.

**Body anatomy**

- Tracking number row
- Status row (the pill)
- Optional Note row (only rendered if a note was supplied)

### 6.3 Password reset code — `sendPasswordResetEmail`

**Signature**

```js
sendPasswordResetEmail({ to, name, code, userId })
```

**Subject** `Your Meenarh Logistics password reset code`
**Preheader** `Password reset code inside · expires in 10 minutes`
**Fires from** `src/routes/auth.routes.js → POST /auth/forgot-password`, in parallel with the WhatsApp `password_reset_code` template.

**OTP display** — the 6-digit code sits inside an **accent-tinted block** (`#e0e9cf` on `#f9faf4` card) with the digits set in mono at `30px` / `letter-spacing: 8px` / `font-weight: 700`. This is the email equivalent of the web's accent-highlighted call-out panel pattern. Expiry copy underneath is muted 13 px text.

The footer is overridden to `If you did not request a password reset, you can safely ignore this email.` to match security-sensitive UX norms.

### 6.4 Email verification — `sendEmailVerificationEmail`

**Signature**

```js
sendEmailVerificationEmail({ to, name, verificationUrl, userId })
```

**Subject** `Verify your Meenarh Logistics email`
**Preheader** `Confirm your email to finish setting up your Meenarh Logistics account`
**Fires from**:

1. `src/controllers/user.controller.js → signup` immediately after the customer row is created.
2. `src/controllers/user.controller.js → requestEmailVerification` (auth-required resend, throttled to once per 60 s by `user.service.js → createEmailVerificationToken({ enforceCooldown: true })`).

**Body anatomy**

- Title: `Verify your email`
- Intro: `Hi {name}, please confirm your email address to finish setting up your Meenarh Logistics account.`
- **Primary CTA button** — solid `#5c8d1d` rectangle, `#ffffff` text, `8px` radius, `13px 22px` padding, label "Verify email". This is the email transliteration of the web's `<Button>` primitive (which compiles to `bg-primary text-primary-foreground rounded-md`).
- "Or paste this link into your browser:" muted helper
- The raw URL in monospace, with `word-break: break-all` so long tokens wrap on narrow viewports.
- Expiry copy: `This link expires in 24 hours.`

The CTA link targets `GET /api/user/verify-email?token=…`, which `userController.verifyEmail` validates and then 302-redirects to `${FRONTEND_BASE_URL}/?email_verified=success` (or `=expired` / `=invalid` / `=error`). The frontend reads that query parameter to render its result UI — no new web page is required beyond reading the param.

---

## 7. Anti-spam & deliverability practices baked in

1. **Domain reputation.** Sender is whatever `EMAIL_FROM` resolves to — a verified domain in the Resend dashboard. Sandbox sender `onboarding@resend.dev` is the documented dev fallback in `.env.example`.
2. **Plain-text alternative** on every send (Resend's `text` field). Spam scorers heavily penalise HTML-only mail.
3. **Preheader text** populated for every template so inbox previews don't surface raw HTML.
4. **Light-mode lock** via `color-scheme: light` meta + `supported-color-schemes: light` so the olive palette never gets auto-inverted into illegible mush in Gmail/Outlook dark mode.
5. **Table-based layout** at 560 px with inline styles only — the lowest-common-denominator format that survives Outlook on Windows.
6. **Idempotency keys** on every send (see §3) to prevent duplicate deliveries on retry.
7. **No tracking pixels / no external images** — every visual element is rendered via CSS-styled HTML, so emails work even when "Display images" is off, and don't drag down spam scores.
8. **No links besides the one CTA in the verification email**, plus the single mono-rendered fallback URL. Other templates are link-free, which suppresses common phishing-classifier heuristics.

---

## 8. Graceful degradation

| Missing config                                      | Behaviour                                                                                                    |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `RESEND_API_KEY` and/or `EMAIL_FROM` unset          | Warn once at boot; every `sendEmail*` call resolves to `undefined` without throwing. App routes still serve. |
| `API_PUBLIC_URL` unset (verification only)          | `signup` and `requestEmailVerification` succeed and create the token, but no email is sent (URL is `null`).  |
| Customer has no `email` on file                     | Email path is skipped at the controller level; WhatsApp (where applicable) still fires.                      |
| Resend API returns an error or throws               | Logged via `console.error` with the subject + recipient; no exception propagates to the controller.          |

This mirrors the exact contract of `whatsapp.service.js` so operators reasoning about one channel can reason about the other.

---

## 9. Adding a new template

1. Add a new `async function send{Thing}Email({ to, … })` to `src/services/email.service.js`.
2. Reuse `wrapHtml` for the shell; reuse `detailRowHtml` / `BRAND` / `formatStatus` / `statusBadgeStyle` as appropriate.
3. Escape every interpolated user value with `escapeHtml()`. Only static literals and already-escaped HTML may be passed into `contentHtml` / `footerHtml`.
4. Pick an idempotency key shape that uniquely identifies the *intended* event (entity id + a value that changes per legitimate send).
5. Always provide a plain-text fallback in the `text` field.
6. Export the function from the module footer and invoke it from the relevant controller **without `await`** so request latency is unaffected.
7. Document the new entry in §3 and §6 of this file.

---

## 10. Quick reference — file map

| File                                                                | Purpose                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------------- |
| [`src/services/email.service.js`](./src/services/email.service.js)  | All four templates + shared shell, Resend client, send helper. |
| [`src/services/user.service.js`](./src/services/user.service.js)    | `createEmailVerificationToken`, `verifyEmailToken` (hashed tokens, 24 h TTL, 60 s resend cooldown). |
| [`src/controllers/user.controller.js`](./src/controllers/user.controller.js) | Fires verification email on signup; `verifyEmail` redirect handler; `requestEmailVerification` resend. |
| [`src/controllers/order.controller.js`](./src/controllers/order.controller.js) | Fires order-confirmation email alongside the WhatsApp send.    |
| [`src/controllers/admin.controller.js`](./src/controllers/admin.controller.js) | Fires status-update email alongside the WhatsApp send.         |
| [`src/routes/auth.routes.js`](./src/routes/auth.routes.js)          | Fires password-reset email alongside the WhatsApp send.        |
| [`src/routes/user.routes.js`](./src/routes/user.routes.js)          | Registers `GET /verify-email` (public) and `POST /email-verification/request` (authed). |
| [`migrations/email-verification-and-flag.sql`](./migrations/email-verification-and-flag.sql) | Adds `customers.is_email_verified` + `email_verifications` table. |
| [`.env.example`](./.env.example)                                    | Documents `RESEND_API_KEY`, `EMAIL_FROM`, and the URL bases.   |
