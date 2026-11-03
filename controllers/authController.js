const SESSION_COOKIE = process.env.NODE_ENV === 'production'
  ? '__Host-la-session'
  : 'la-session';
const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_DURATION_MS,
  };
}

async function login(req, res) {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const { firebaseAuth } = require('../config/supabase');

  if (!email || !password || password.length > 256) {
    return res.status(400).json({ message: 'Email dan kata sandi wajib diisi.' });
  }

  const auth = firebaseAuth();
  const { data, error } = await auth.auth.signInWithPassword({ email, password });

  if (error || !data?.session || !data?.user) {
    return res.status(401).json({ message: 'Email atau kata sandi tidak cocok.' });
  }

  const { data: userData, error: userError } = await auth.auth.getUser(data.session.access_token);
  if (userError || !userData?.user) {
    return res.status(401).json({ message: 'Sesi tidak valid.' });
  }

  const role = userData.user.app_metadata?.role || userData.user.user_metadata?.role;
  if (!['admin', 'petugas'].includes(role)) {
    return res.status(403).json({ message: 'Akun belum diberi peran petugas oleh administrator.' });
  }

  res.cookie(SESSION_COOKIE, data.session.access_token, cookieOptions());
  return res.json({
    user: {
      name: userData.user.user_metadata?.staffName || userData.user.user_metadata?.name || userData.user.email || 'Petugas',
      email: userData.user.email || '',
      role,
      unit: userData.user.app_metadata?.unit || userData.user.user_metadata?.unit || '',
    },
  });
}

function me(req, res) {
  return res.json({ user: req.user });
}

async function logout(req, res) {
  const sessionCookie = req.cookies?.[SESSION_COOKIE];
  if (sessionCookie) {
    try {
      const { firebaseAuth } = require('../config/supabase');
      const auth = firebaseAuth();
      await auth.auth.signOut();
    } catch {
    }
  }

  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
  return res.status(204).end();
}

module.exports = { login, logout, me };