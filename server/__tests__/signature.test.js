const { verifySignature, computeSignature } = require('../services/signature');

describe('Signature Verification (HMAC-SHA256)', () => {
  const secret = 'test_app_secret_12345';
  const payload = JSON.stringify({
    entry: [
      {
        id: '123456789',
        changes: [
          {
            field: 'leadgen',
            value: { leadgen_id: '999888777', form_id: '111', page_id: '222' },
          },
        ],
      },
    ],
  });

  it('accepts a valid signature matching the payload', () => {
    const signature = computeSignature(payload, secret);
    const isValid = verifySignature(payload, secret, signature);
    expect(isValid).toBe(true);
  });

  it('accepts a valid signature with Buffer input', () => {
    const buf = Buffer.from(payload, 'utf8');
    const signature = computeSignature(buf, secret);
    const isValid = verifySignature(buf, secret, signature);
    expect(isValid).toBe(true);
  });

  it('rejects an invalid signature with wrong secret', () => {
    const signature = computeSignature(payload, 'wrong_secret');
    const isValid = verifySignature(payload, secret, signature);
    expect(isValid).toBe(false);
  });

  it('rejects a tampered body even if signature was valid for original body', () => {
    const signature = computeSignature(payload, secret);
    const tamperedPayload = payload.replace('999888777', '999888778');
    const isValid = verifySignature(tamperedPayload, secret, signature);
    expect(isValid).toBe(false);
  });

  it('rejects malformed signature headers', () => {
    expect(verifySignature(payload, secret, '')).toBe(false);
    expect(verifySignature(payload, secret, 'invalid_header')).toBe(false);
    expect(verifySignature(payload, secret, 'sha1=123456')).toBe(false);
    expect(verifySignature(null, secret, 'sha256=123')).toBe(false);
    expect(verifySignature(payload, null, 'sha256=123')).toBe(false);
  });
});
