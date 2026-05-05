## WhatsApp Business Messaging Policy + Templates (Meenarh)

This document defines:
- What we must do to stay compliant with the **WhatsApp Business Messaging Policy**
- The **exact WhatsApp message templates** our backend sends
- How to create/approve those templates in the **WhatsApp Business Platform**

Applies to `meenarh-server` (WhatsApp Cloud API via Meta Graph API) and the templates referenced in code:
- `phone_verification_code`
- `phone_verification_link` (deprecated)
- `password_reset_link`
- `order_confirmation`
- `order_status_update`

---

## Policy requirements (practical summary)

This is a practical summary of the WhatsApp Business Messaging Policy (see: `https://business.whatsapp.com/policy`).

- **Opt-in is required**
  - We may only message people if:
    - they gave us their phone number, **and**
    - they opted in to receive messages from Meenarh on WhatsApp.
  - Recommended: store opt-in timestamp + source (web signup, checkout, etc).

- **Be clear and non-deceptive**
  - Templates must clearly identify Meenarh and the reason for the message.
  - Do not impersonate another business or mislead recipients.

- **Do not request sensitive identifiers**
  - Do not ask users to share:
    - payment card numbers
    - bank account numbers
    - government IDs
    - other sensitive identifiers

- **Support escalation paths**
  - If you automate support, you should offer a clear escalation path (human agent / email / phone / website support).
  - Note: our current backend does **not** receive inbound WhatsApp messages (no webhook). If you add “Reply STOP” or “Reply HELP”, you must implement inbound handling.

---

## Implementation notes (how `meenarh-server` sends templates)

Templates are sent with `sendTemplateMessage()`:

- `template.name` must match exactly.
- `language.code` is currently `en`.
- `components[0]` is `type: "body"` with ordered `parameters`.

Code reference:

```1:77:/home/aremzy03/Document/cursor_projects/meenarh/meenarh-server/src/services/whatsapp.service.js
async function sendTemplateMessage({ to, templateName, languageCode = 'en', components }) {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: templateName,
      language: { code: languageCode },
    },
  };
  if (components && components.length > 0) {
    payload.template.components = components;
  }
  await http.post('/messages', payload);
}
```

---

## How to create templates in WhatsApp Business Platform (WhatsApp Manager)

1) Open **WhatsApp Manager** for the correct WhatsApp Business Account (WABA).
2) Go to **Account tools → Message templates**.
3) Click **Create template**.
4) Set:
   - **Category**: Use **Utility** for these transactional/account messages.
   - **Language**: **English** (`en`)
   - **Name**: Must match exactly (see template specs below).
5) In the **Body**, add placeholders exactly as specified (e.g. `{{1}}`, `{{2}}`).
6) Submit for approval.
7) After approval, test sending to a whitelisted/test number (during development) and verify that:
   - placeholders render correctly,
   - links work,
   - the phone number is in the correct format (E.164 digits recommended).

Important:
- Placeholder count/order must match the backend parameters.
- Keep the content strictly transactional. Avoid marketing language unless you have separate opt-in for marketing templates.

---

## Template specifications (approved content + placeholders)

All templates below are designed to:
- match the current backend parameter order,
- stay within policy expectations (clear purpose, no sensitive data requests),
- be suitable for **Utility** category.

### 1) `phone_verification_code`

- **Category**: Utility
- **Language**: English (`en`)
- **Backend placeholders**:
  - `{{1}}`: customer name
  - `{{2}}`: 6-digit verification code
  - `{{3}}`: expiry minutes (e.g. `10`)

**Template content**
- **Header** (optional): `Verify your phone`
- **Body**:

```text
Hi {{1}}, your Meenarh Logistics verification code is:
{{2}}

This code expires in {{3}} minutes.
If you didn’t create an account, ignore this message.
```

- **Footer** (optional): `Meenarh Logistics`

Backend mapping reference:

```30:55:/home/aremzy03/Document/cursor_projects/meenarh/meenarh-server/src/controllers/user.controller.js
sendTemplateMessage({
  to: customer.phone,
  templateName: 'phone_verification_code',
  languageCode: 'en',
  components: [
    {
      type: 'body',
      parameters: [
        { type: 'text', text: customer.name || 'there' }, // {{1}}
        { type: 'text', text: code },                     // {{2}}
        { type: 'text', text: '10' },                     // {{3}}
      ],
    },
  ],
});
```

---

### 2) `phone_verification_link` (deprecated)

- **Category**: Utility
- **Language**: English (`en`)
- **Backend placeholders**:
  - `{{1}}`: customer name
  - `{{2}}`: verification link (API URL: `/api/user/verify-phone?token=...`)

**Status**: Deprecated. The backend now uses OTP codes (`phone_verification_code`) instead of link tokens.

**Template content**
- **Header** (optional): `Verify your phone`
- **Body**:

```text
Hi {{1}}, confirm your phone number for Meenarh Logistics using this secure link:
{{2}}

If you didn’t create an account, ignore this message.
```

- **Footer** (optional): `Meenarh Logistics`

Backend mapping reference:

```39:53:/home/aremzy03/Document/cursor_projects/meenarh/meenarh-server/src/controllers/user.controller.js
parameters: [
  { type: 'text', text: customer.name || 'there' }, // {{1}}
  { type: 'text', text: verificationLink },         // {{2}}
],
```

---

### 3) `password_reset_link`

- **Category**: Utility
- **Language**: English (`en`)
- **Backend placeholders**:
  - `{{1}}`: customer name
  - `{{2}}`: reset link (frontend URL: `/reset-password?token=...`)

**Template content**
- **Header** (optional): `Password reset`
- **Body**:

```text
Hi {{1}}, we received a request to reset your Meenarh Logistics password.
Reset it here:
{{2}}

If you didn’t request this, ignore this message.
```

- **Footer** (optional): `Meenarh Logistics`

Backend mapping reference:

```49:63:/home/aremzy03/Document/cursor_projects/meenarh/meenarh-server/src/routes/auth.routes.js
parameters: [
  { type: 'text', text: customer.name || 'there' }, // {{1}}
  { type: 'text', text: resetUrl },                 // {{2}}
],
```

---

### 3) `order_confirmation`

- **Category**: Utility
- **Language**: English (`en`)
- **Backend placeholders**:
  - `{{1}}`: customer name
  - `{{2}}`: tracking number
  - `{{3}}`: price (string)

**Template content**
- **Header** (optional): `Order confirmed`
- **Body**:

```text
Hi {{1}}, your Meenarh Logistics order is confirmed.
Tracking number: {{2}}
Price: ₦{{3}}

We’ll notify you when your order status changes.
```

- **Footer** (optional): `Meenarh Logistics`

Backend mapping reference:

```19:33:/home/aremzy03/Document/cursor_projects/meenarh/meenarh-server/src/controllers/order.controller.js
parameters: [
  { type: 'text', text: customer.name || 'there' },   // {{1}}
  { type: 'text', text: result.trackingNumber },      // {{2}}
  { type: 'text', text: String(result.price ?? '') }, // {{3}}
],
```

---

### 4) `order_status_update`

- **Category**: Utility
- **Language**: English (`en`)
- **Backend placeholders**:
  - `{{1}}`: customer name
  - `{{2}}`: tracking number
  - `{{3}}`: status
  - `{{4}}`: note (may be empty string)

**Template content**
- **Header** (optional): `Order update`
- **Body**:

```text
Hi {{1}}, update from Meenarh Logistics:
Tracking number: {{2}}
Status: {{3}}
Note: {{4}}
```

- **Footer** (optional): `Meenarh Logistics`

Backend mapping reference:

```97:113:/home/aremzy03/Document/cursor_projects/meenarh/meenarh-server/src/controllers/admin.controller.js
parameters: [
  { type: 'text', text: customer.name || 'there' }, // {{1}}
  { type: 'text', text: order.tracking_number },    // {{2}}
  { type: 'text', text: status },                   // {{3}}
  note ? { type: 'text', text: note } : { type: 'text', text: '' }, // {{4}}
],
```

---

## Recommended next steps (optional, but improves compliance/quality)

- **Add opt-out handling**
  - If you want to include “Reply STOP to opt out”, implement:
    - WhatsApp inbound webhook for messages,
    - storage of opt-out state,
    - suppression of future non-essential messages.

- **Template governance**
  - Keep template names stable once approved (code depends on them).
  - Keep a change log if you revise template content.

