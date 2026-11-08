const { supabaseAdmin, supabaseAuth } = require('../config/supabase');

const STAFF_TABLE = 'staff_profiles';

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

async function loadStaffProfile(userData) {
  const admin = supabaseAdmin();
  const { data: profileRow, error } = await admin
    .from(STAFF_TABLE)
    .select('*')
    .eq('auth_user_id', userData.id)
    .maybeSingle();

  if (!error && profileRow) {
    return profileRow;
  }

  const { data: emailProfile, error: emailError } = await admin
    .from(STAFF_TABLE)
    .select('*')
    .eq('email', String(userData.email || '').trim().toLowerCase())
    .maybeSingle();

  if (emailError) {
    throw emailError;
  }

  return emailProfile || null;
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

  let profile;
  try {
    profile = await loadStaffProfile(userData);
  } catch {
    return res.status(403).json({ message: 'Akun petugas tidak terdaftar dengan profil yang valid.' });
  }

  if (!profile || profile.status !== 'registered') {
    return res.status(403).json({ message: 'Akun petugas belum aktif atau belum terdaftar.' });
  }

  const role = profile.role;
  if (!['admin', 'petugas'].includes(role)) {
    return res.status(403).json({ message: 'Akun ini tidak memiliki akses petugas.' });
  }

  req.user = {
    uid: userData.id,
    email: profile.email || userData.email || '',
    name: profile.name || userData.user_metadata?.staffName || userData.user_metadata?.name || userData.email || 'Petugas',
    role,
    unit: profile.unit || '',
  };
  return next();
});

const requireAdmin = asyncHandler(async (req, res, next) => {
  let isStaffAuthorized = false;

  await requireStaff(req, res, () => {
    isStaffAuthorized = true;
  });

  if (res.headersSent || res.writableEnded || !isStaffAuthorized) {
    return;
  }

  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Hanya admin yang dapat mengakses endpoint ini.' });
  }

  return next();
});

module.exports = { asyncHandler, requireAdmin, requireStaff };