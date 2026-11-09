const path = require('path');
const { normalizeError } = require('./errors');

function registerGlobalMiddleware(app) {
  app.disable('x-powered-by');
  if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use(
    require('helmet')({
      contentSecurityPolicy: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    }),
  );
  app.use(require('express').json({ limit: '4mb' }));
  app.use(require('cookie-parser')());
}

function registerStaticFiles(app, publicDir) {
  app.use('/vendor/leaflet', require('express').static(path.dirname(require.resolve('leaflet'))));
  app.use(require('express').static(publicDir));
}

function registerSpaFallback(app, publicDir) {
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }

    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

function registerErrorHandler(app) {
  app.use((error, req, res, next) => {
    const normalized = normalizeError(error);

    if (normalized.code !== 'SUPABASE_CONFIG_MISSING') console.error(normalized);

    const status = normalized.status || (normalized.code === 'SUPABASE_CONFIG_MISSING' ? 503 : 500);
    const message = status === 503
      ? 'Backend Supabase belum dikonfigurasi. Periksa environment dan kredensial server.'
      : normalized.message || 'Terjadi kesalahan pada server.';

    res.status(status).json({
      message,
      code: normalized.code,
    });
  });
}

module.exports = {
  registerErrorHandler,
  registerGlobalMiddleware,
  registerSpaFallback,
  registerStaticFiles,
};
