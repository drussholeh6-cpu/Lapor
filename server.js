require('dotenv').config();

const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const complaintRoutes = require('./routes/complaintRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, 'public');

app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '4mb' }));
app.use(cookieParser());

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    message: 'Lacak Aduan backend siap digunakan',
    timestamp: new Date().toISOString(),
    app: 'lacak-aduan',
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', complaintRoutes);
app.use(express.static(publicDir));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  res.sendFile(path.join(publicDir, 'index.html'));
});

app.use((error, req, res, next) => {
  if (error.code !== 'FIREBASE_CONFIG_MISSING') console.error(error);
  const status = error.status || (error.code === 'FIREBASE_CONFIG_MISSING' ? 503 : 500);
  res.status(status).json({
    message: status === 503
      ? 'Backend Firebase belum dikonfigurasi. Periksa environment dan kredensial server.'
      : 'Terjadi kesalahan pada server.',
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
  });
}

module.exports = app;

