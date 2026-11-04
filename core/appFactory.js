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

  app.get('/api/health', async (req, res) => {
    let dbStatus = 'unknown';
    let dbMessage = 'Database check not run';

    try {
      const { realtimeDatabase } = require('../config/supabase');
      const { data, error } = await realtimeDatabase()
        .from('complaints')
        .select('code')
        .limit(1);

      if (error) {
        dbStatus = 'error';
        dbMessage = error.message;
      } else {
        dbStatus = 'ok';
        dbMessage = 'Supabase connection successful';
      }
    } catch (error) {
      dbStatus = 'error';
      dbMessage = error.message;
    }

    res.json({
      ok: true,
      message: 'Lacak Aduan backend siap digunakan',
      timestamp: new Date().toISOString(),
      app: 'lacak-aduan',
      database: {
        status: dbStatus,
        message: dbMessage,
      },
    });
  });

  registerRoutes(app);
  registerStaticFiles(app, publicDir);
  registerSpaFallback(app, publicDir);
  registerErrorHandler(app);

  return app;
}

module.exports = createApp;
