const { firebaseAuth } = require('../config/firebaseAdmin');

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const requireStaff = asyncHandler(async (req, res, next) => {
  const sessionCookie = req.cookies?.['__Host-la-session'] || req.cookies?.['la-session'];
  if (!sessionCookie) {
    return res.status(401).json({ message: 'Silakan masuk sebagai petugas.' });
  }

  let claims;
  try {
    claims = await firebaseAuth().verifySessionCookie(sessionCookie, true);
  } catch {
    return res.status(401).json({ message: 'Sesi tidak valid atau sudah berakhir. Silakan masuk kembali.' });
  }

  if (!['admin', 'petugas'].includes(claims.role)) {
    return res.status(403).json({ message: 'Akun ini tidak memiliki akses petugas.' });
  }

  req.user = {
    uid: claims.uid,
    email: claims.email || '',
    name: claims.staffName || claims.email || 'Petugas',
    role: claims.role,
    unit: claims.unit || '',
  };
  return next();
});

module.exports = { asyncHandler, requireStaff };