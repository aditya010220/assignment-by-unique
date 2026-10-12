const crypto = require('crypto');

/**
 * Computes Meta's x-hub-signature-256 HMAC for a given payload and secret.
 * @param {Buffer|string} rawBody
 * @param {string} appSecret
 * @returns {string} e.g. "sha256=abcdef..."
 */
function computeSignature(rawBody, appSecret) {
  if (!rawBody || !appSecret) {
    throw new Error('rawBody and appSecret are required to compute signature');
  }
  const hmac = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody)
    .digest('hex');
  return `sha256=${hmac}`;
}

/**
 * Verifies the x-hub-signature-256 header against the raw body using the app secret.
 * @param {Buffer|string} rawBody - Raw body buffer or string
 * @param {string} appSecret - Meta App Secret
 * @param {string} signatureHeader - Header value e.g. "sha256=abcdef..."
 * @returns {boolean}
 */
function verifySignature(rawBody, appSecret, signatureHeader) {
  if (!rawBody || !appSecret || !signatureHeader) {
    return false;
  }

  const parts = signatureHeader.split('=');
  if (parts.length !== 2 || parts[0] !== 'sha256') {
    return false;
  }

  const expectedSignature = computeSignature(rawBody, appSecret);
  const expectedHash = expectedSignature.split('=')[1];
  const providedHash = parts[1];

  const expectedBuf = Buffer.from(expectedHash, 'utf8');
  const providedBuf = Buffer.from(providedHash, 'utf8');

  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

module.exports = {
  verifySignature,
  computeSignature,
};
