const axios = require('axios');

const {
  WHATSAPP_ACCESS_TOKEN,
  WHATSAPP_PHONE_NUMBER_ID,
  WHATSAPP_API_VERSION = 'v21.0',
  WHATSAPP_API_BASE_URL = 'https://graph.facebook.com',
} = process.env;

if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
  // eslint-disable-next-line no-console
  console.warn(
    '[WhatsAppService] Missing WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID. WhatsApp messaging will be disabled.'
  );
}

const http = axios.create({
  baseURL: `${WHATSAPP_API_BASE_URL}/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}`,
  headers: {
    Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

async function sendTextMessage({ to, body }) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return;
  }

  try {
    await http.post('/messages', {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[WhatsAppService] Failed to send text message', err.response?.data || err.message);
  }
}

async function sendTemplateMessage({ to, templateName, languageCode = 'en', components }) {
  if (!WHATSAPP_ACCESS_TOKEN || !WHATSAPP_PHONE_NUMBER_ID) {
    return;
  }

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

  try {
    await http.post('/messages', payload);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      '[WhatsAppService] Failed to send template message',
      err.response?.data || err.message
    );
  }
}

module.exports = {
  sendTextMessage,
  sendTemplateMessage,
};

