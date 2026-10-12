const http = require('http');
const express = require('express');
const env = require('./config/env');
const { rawBodyMiddleware } = require('./middleware/rawBody');
const { initSocket, getConnectedClientsCount } = require('./realtime/io');
const { webhookRouter } = require('./routes/webhook');
const { leadsRouter } = require('./routes/leads');

function createApp() {
  const app = express();

  // Middleware
  app.use(rawBodyMiddleware());

  // CORS headers for simple REST client testing
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health endpoint
  app.get('/health', (req, res) => {
    res.status(200).json({
      status: 'ok',
      connectedClients: getConnectedClientsCount(),
      timestamp: new Date().toISOString(),
    });
  });

  // Routes
  app.use('/webhook', webhookRouter);
  app.use('/leads', leadsRouter);

  return app;
}

const app = createApp();
const server = http.createServer(app);

// Initialize real-time Socket.IO layer
initSocket(server);

// If executed directly (not required by test)
if (require.main === module) {
  try {
    env.validateEnv();
  } catch (err) {
    console.error(`[Startup Error] ${err.message}`);
    process.exit(1);
  }

  const port = env.PORT;
  server.listen(port, () => {
    console.log(`===============================================`);
    console.log(` Meta Lead Ads Real-Time Server running on :${port}`);
    console.log(` Health check: http://localhost:${port}/health`);
    console.log(` Webhook URL: http://localhost:${port}/webhook`);
    console.log(` REST Leads URL: http://localhost:${port}/leads`);
    console.log(`===============================================`);
  });
}

module.exports = {
  app,
  server,
  createApp,
};
