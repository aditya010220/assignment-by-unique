const express = require('express');
const { leadStore: defaultLeadStore } = require('../services/leadStore');

function createLeadsRouter(store = defaultLeadStore) {
  const router = express.Router();

  /**
   * GET /leads
   * Query params:
   *   since: optional ISO timestamp string
   */
  router.get('/', async (req, res) => {
    try {
      const { since } = req.query;
      const leads = await store.listSince(since);
      res.status(200).json(leads);
    } catch (err) {
      console.error('Error fetching leads:', err);
      res.status(500).json({ error: 'Failed to retrieve leads' });
    }
  });

  return router;
}

const leadsRouter = createLeadsRouter();

module.exports = {
  createLeadsRouter,
  leadsRouter,
};
