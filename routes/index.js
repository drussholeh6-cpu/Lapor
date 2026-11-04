const authRoutes = require('./authRoutes');
const complaintRoutes = require('./complaintRoutes');

function registerRoutes(app) {
  app.use('/api/auth', authRoutes);
  app.use('/api', complaintRoutes);
  return app;
}

module.exports = { registerRoutes };
