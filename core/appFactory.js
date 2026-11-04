const express = require('express');
const path = require('path');
const { registerRoutes } = require('../routes');
const {
  registerErrorHandler,
  registerGlobalMiddleware,
  registerSpaFallback,
  registerStaticFiles,
} = require('./middleware');

function createApp(options = {}) {
  const app = express();
  const publicDir = options.publicDir || path.join(__dirname, '..', 'public');

  registerGlobalMiddleware(app);

  app.get('/api/health', (req, res) => {
    res.json({
      ok: true,
      message: 'Lacak Aduan backend siap digunakan',
      timestamp: new Date().toISOString(),
      app: 'lacak-aduan',
    });
  });

  registerRoutes(app);
  registerStaticFiles(app, publicDir);
  registerSpaFallback(app, publicDir);
  registerErrorHandler(app);

  return app;
}

module.exports = createApp;
