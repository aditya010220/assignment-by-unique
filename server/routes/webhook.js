const express = require('express');
const defaultEnv = require('../config/env');
const { verifySignature } = require('../services/signature');
const { leadStore: defaultLeadStore } = require('../services/leadStore');
const defaultRealtime = require('../realtime/io');
const defaultGraphApi = require('../services/graphApi');

function createWebhookRouter({
  envConfig = defaultEnv,
  store = defaultLeadStore,
  realtime = defaultRealtime,
  graphApi = defaultGraphApi,
} = {}) {
  const router = express.Router();

  /**
   * GET /webhook
   * Meta subscription verification handshake.
   */
  router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === envConfig.VERIFY_TOKEN) {
      console.log('[Webhook] Verification handshake successful');
      return res.status(200).send(challenge);
    }

    console.warn('[Webhook] Verification handshake failed. Token mismatch or bad mode.');
    return res.status(403).send('Forbidden');
  });

  /**
   * POST /webhook
   * Meta Lead Ads event delivery.
   * Requirement: ack-then-process (respond 200 before Graph API fetch).
   */
  router.post('/', (req, res) => {
    const signature = req.headers['x-hub-signature-256'];
    const rawBody = req.rawBody;

    // Validate signature
    if (!verifySignature(rawBody, envConfig.APP_SECRET, signature)) {
      console.warn('[Webhook] Signature verification failed');
      return res.status(401).json({ error: 'Invalid x-hub-signature-256 signature' });
    }

    // 1. Respond 200 OK immediately (Ack-then-process)
    res.status(200).json({ status: 'received' });

    // 2. Process asynchronous lead pipeline
    setImmediate(async () => {
      try {
        const body = req.body || {};
        const entries = Array.isArray(body.entry) ? body.entry : [];

        for (const entry of entries) {
          const changes = Array.isArray(entry.changes) ? entry.changes : [];
          for (const change of changes) {
            if (change.field !== 'leadgen') continue;

            const val = change.value || {};
            const leadgenId = val.leadgen_id;
            if (!leadgenId) continue;

            console.log(JSON.stringify({
              leadgenId,
              event: 'received',
              timestamp: new Date().toISOString(),
            }));

            // Idempotency check: drop if already processed
            const alreadyExists = await store.exists(leadgenId);
            if (alreadyExists) {
              console.log(JSON.stringify({
                leadgenId,
                event: 'dropped_duplicate',
                timestamp: new Date().toISOString(),
              }));
              continue;
            }

            try {
              const lead = await graphApi.fetchLead(leadgenId, {
                metadata: val,
              });

              // Guard against race condition on double delivery
              if (await store.exists(lead.id)) {
                continue;
              }

              await store.save(lead);
              realtime.emitNewLead(lead);

              console.log(JSON.stringify({
                leadgenId,
                event: 'emitted',
                timestamp: new Date().toISOString(),
              }));
            } catch (err) {
              console.error(JSON.stringify({
                leadgenId,
                event: 'fetch_error',
                error: err.message,
                timestamp: new Date().toISOString(),
              }));

              // Create fallback placeholder lead so data is not lost silently
              const fallbackLead = graphApi.createFallbackLead(leadgenId, val, err);
              if (!(await store.exists(fallbackLead.id))) {
                await store.save(fallbackLead);
                realtime.emitNewLead(fallbackLead);
              }
            }
          }
        }
      } catch (err) {
        console.error('[Webhook] Unhandled background processing error:', err);
      }
    });
  });

  return router;
}

const webhookRouter = createWebhookRouter();

module.exports = {
  createWebhookRouter,
  webhookRouter,
};
