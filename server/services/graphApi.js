const axios = require('axios');
const env = require('../config/env');

/**
 * Normalizes Meta field_data array into a key-value object and extracts standard fields.
 * @param {Array<{name: string, values: string[]}>} fieldData
 */
function normalizeFieldData(fieldData = []) {
  const rawFieldData = {};
  let name;
  let email;
  let phone;

  for (const field of fieldData) {
    if (!field || !field.name) continue;
    const key = field.name.toLowerCase();
    const val = Array.isArray(field.values) && field.values.length > 0 ? field.values[0] : '';
    rawFieldData[field.name] = val;

    if (!name && (key === 'full_name' || key === 'name')) {
      name = val;
    }
    if (!email && (key === 'email' || key.includes('email'))) {
      email = val;
    }
    if (!phone && (key === 'phone_number' || key === 'phone' || key.includes('phone'))) {
      phone = val;
    }
  }

  // If first_name / last_name exist but not full_name
  if (!name && (rawFieldData.first_name || rawFieldData.last_name)) {
    name = [rawFieldData.first_name, rawFieldData.last_name].filter(Boolean).join(' ');
  }

  return { name, email, phone, rawFieldData };
}

/**
 * Fetches lead details from Meta Graph API with retry backoff.
 * @param {string} leadgenId
 * @param {Object} [options]
 * @param {number} [options.maxRetries=2]
 * @param {number} [options.initialDelayMs=50]
 * @param {Object} [options.metadata] - Optional { form_id, page_id } from webhook
 * @returns {Promise<Object>}
 */
async function fetchLead(leadgenId, options = {}) {
  const maxRetries = options.maxRetries !== undefined ? options.maxRetries : 2;
  const initialDelayMs = options.initialDelayMs !== undefined ? options.initialDelayMs : 50;
  const metadata = options.metadata || {};
  const token = env.PAGE_ACCESS_TOKEN;

  const url = `https://graph.facebook.com/v19.0/${leadgenId}`;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(url, {
        params: {
          access_token: token,
          fields: 'id,created_time,ad_id,form_id,page_id,field_data',
        },
        timeout: 5000,
      });

      const data = response.data || {};
      const { name, email, phone, rawFieldData } = normalizeFieldData(data.field_data);

      return {
        id: String(data.id || leadgenId),
        formId: String(data.form_id || metadata.form_id || ''),
        pageId: String(data.page_id || metadata.page_id || ''),
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
        rawFieldData,
        receivedAt: new Date().toISOString(),
      };
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = initialDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Creates a placeholder lead when Graph API fetch fails after retries.
 */
function createFallbackLead(leadgenId, metadata = {}, error) {
  return {
    id: String(leadgenId),
    formId: String(metadata.form_id || 'unknown'),
    pageId: String(metadata.page_id || 'unknown'),
    name: '[Fetch Failed - Placeholder]',
    email: undefined,
    phone: undefined,
    rawFieldData: {
      error: error ? error.message : 'Graph API fetch failed',
    },
    receivedAt: new Date().toISOString(),
  };
}

module.exports = {
  fetchLead,
  normalizeFieldData,
  createFallbackLead,
};
