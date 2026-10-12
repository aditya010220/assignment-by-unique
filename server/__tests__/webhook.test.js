const request = require('supertest');
const express = require('express');
const { rawBodyMiddleware } = require('../middleware/rawBody');
const { computeSignature } = require('../services/signature');
const { InMemoryLeadStore } = require('../services/leadStore');
const { createWebhookRouter } = require('../routes/webhook');
const { createLeadsRouter } = require('../routes/leads');

describe('Webhook Routes & Integration', () => {
  const TEST_VERIFY_TOKEN = 'test_secret_token_abc';
  const TEST_APP_SECRET = 'test_app_secret_xyz';

  let mockStore;
  let mockRealtime;
  let mockGraphApi;
  let app;

  beforeEach(() => {
    mockStore = new InMemoryLeadStore();
    mockRealtime = {
      emitNewLead: jest.fn(),
    };
    mockGraphApi = {
      fetchLead: jest.fn().mockImplementation(async (id, opts) => ({
        id,
        formId: opts?.metadata?.form_id || 'form_123',
        pageId: opts?.metadata?.page_id || 'page_456',
        name: 'Jane Mark',
        email: 'jane@example.com',
        phone: '+15550001',
        rawFieldData: { full_name: 'Jane Mark' },
        receivedAt: new Date().toISOString(),
      })),
      createFallbackLead: jest.fn().mockImplementation((id, meta, err) => ({
        id,
        name: '[Fetch Failed - Placeholder]',
        rawFieldData: { error: err.message },
        receivedAt: new Date().toISOString(),
      })),
    };

    const webhookRouter = createWebhookRouter({
      envConfig: {
        VERIFY_TOKEN: TEST_VERIFY_TOKEN,
        APP_SECRET: TEST_APP_SECRET,
      },
      store: mockStore,
      realtime: mockRealtime,
      graphApi: mockGraphApi,
    });

    const leadsRouter = createLeadsRouter(mockStore);

    app = express();
    app.use(rawBodyMiddleware());
    app.use('/webhook', webhookRouter);
    app.use('/leads', leadsRouter);
  });

  describe('GET /webhook (Subscription Verification)', () => {
    it('returns 200 and challenge string when token and mode are valid', async () => {
      const response = await request(app)
        .get('/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': TEST_VERIFY_TOKEN,
          'hub.challenge': 'CHALLENGE_STRING_12345',
        });

      expect(response.status).toBe(200);
      expect(response.text).toBe('CHALLENGE_STRING_12345');
    });

    it('returns 403 when verify_token does not match', async () => {
      const response = await request(app)
        .get('/webhook')
        .query({
          'hub.mode': 'subscribe',
          'hub.verify_token': 'wrong_token',
          'hub.challenge': 'CHALLENGE_STRING_12345',
        });

      expect(response.status).toBe(403);
    });

    it('returns 403 when hub.mode is not subscribe', async () => {
      const response = await request(app)
        .get('/webhook')
        .query({
          'hub.mode': 'other_mode',
          'hub.verify_token': TEST_VERIFY_TOKEN,
          'hub.challenge': 'CHALLENGE_STRING_12345',
        });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /webhook (Lead Notification)', () => {
    const createPayload = (leadgenId) =>
      JSON.stringify({
        entry: [
          {
            id: 'page_456',
            changes: [
              {
                field: 'leadgen',
                value: {
                  leadgen_id: leadgenId,
                  form_id: 'form_123',
                  page_id: 'page_456',
                  created_time: 1712900000,
                },
              },
            ],
          },
        ],
      });

    it('rejects requests with invalid or missing signature with 401', async () => {
      const body = createPayload('lead_test_001');

      // Missing signature
      const resNoSig = await request(app)
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .send(body);
      expect(resNoSig.status).toBe(401);

      // Wrong signature
      const resBadSig = await request(app)
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', 'sha256=badbadbadbad')
        .send(body);
      expect(resBadSig.status).toBe(401);
      expect(mockRealtime.emitNewLead).not.toHaveBeenCalled();
    });

    it('implements ack-before-fetch: responds 200 immediately before slow Graph API resolves', async () => {
      let graphApiCompleted = false;

      mockGraphApi.fetchLead.mockImplementation(async (id) => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        graphApiCompleted = true;
        return {
          id,
          name: 'Slow Lead',
          receivedAt: new Date().toISOString(),
        };
      });

      const body = createPayload('lead_slow_001');
      const sig = computeSignature(body, TEST_APP_SECRET);

      const startTime = Date.now();
      const res = await request(app)
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', sig)
        .send(body);
      const elapsed = Date.now() - startTime;

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'received' });
      // The HTTP response returned BEFORE graph API completed
      expect(graphApiCompleted).toBe(false);
      expect(elapsed).toBeLessThan(120);

      // Wait for background async task to finish
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(graphApiCompleted).toBe(true);
      expect(mockRealtime.emitNewLead).toHaveBeenCalledTimes(1);
    });

    it('enforces idempotency: duplicate deliveries produce exactly one emit and one saved lead', async () => {
      const body = createPayload('lead_dup_001');
      const sig = computeSignature(body, TEST_APP_SECRET);

      // First webhook delivery
      const res1 = await request(app)
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', sig)
        .send(body);
      expect(res1.status).toBe(200);

      // Wait for first processing to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Second webhook delivery (Meta retry)
      const res2 = await request(app)
        .post('/webhook')
        .set('Content-Type', 'application/json')
        .set('x-hub-signature-256', sig)
        .send(body);
      expect(res2.status).toBe(200);

      // Wait a moment
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Exactly 1 fetch, 1 emit, 1 stored lead
      expect(mockGraphApi.fetchLead).toHaveBeenCalledTimes(1);
      expect(mockRealtime.emitNewLead).toHaveBeenCalledTimes(1);
      expect(await mockStore.count()).toBe(1);
    });

    it('retrieves leads via GET /leads REST endpoint', async () => {
      await mockStore.save({
        id: 'stored_lead_1',
        name: 'Existing Lead',
        receivedAt: new Date().toISOString(),
      });

      const res = await request(app).get('/leads');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].id).toBe('stored_lead_1');
    });
  });
});
