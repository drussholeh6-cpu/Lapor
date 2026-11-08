const { supabaseAuth } = require('../config/supabase');

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

const requireStaff = asyncHandler(async (req, res, next) => {
  const sessionCookie = req.cookies?.['__Host-la-session'] || req.cookies?.['la-session'];
  if (!sessionCookie) {
    return res.status(401).json({ message: 'Silakan masuk sebagai petugas.' });
  }

  let userData;
  try {
    const auth = supabaseAuth();
    const { data, error } = await auth.auth.getUser(sessionCookie);
    if (error || !data?.user) {
      throw new Error('session invalid');
    }
    userData = data.user;
  } catch {
    return res.status(401).json({ message: 'Sesi tidak valid atau sudah berakhir. Silakan masuk kembali.' });
  }

  const role = userData.app_metadata?.role || userData.user_metadata?.role;
  if (!['admin', 'petugas'].includes(role)) {
    return res.status(403).json({ message: 'Akun ini tidak memiliki akses petugas.' });
  }

  req.user = {
    uid: userData.id,
    email: userData.email || '',
    name: userData.user_metadata?.staffName || userData.user_metadata?.name || userData.email || 'Petugas',
    role,
    unit: userData.app_metadata?.unit || userData.user_metadata?.unit || '',
  };
  return next();
});

module.exports = { asyncHandler, requireStaff };