const express = require('express');

/**
 * Express JSON middleware configured to retain raw request body buffer on req.rawBody
 * for HMAC-SHA256 signature verification.
 */
function rawBodyMiddleware() {
  return express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  });
}

module.exports = {
  rawBodyMiddleware,
};
