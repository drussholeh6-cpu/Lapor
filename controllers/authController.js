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
  const apiKey = process.env.FIREBASE_WEB_API_KEY;

  if (!apiKey) {
    return res.status(503).json({ message: 'FIREBASE_WEB_API_KEY belum dikonfigurasi.' });
  }
  if (!email || !password || password.length > 256) {
    return res.status(400).json({ message: 'Email dan kata sandi wajib diisi.' });
  }

  const signInResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const signIn = await signInResponse.json();
  if (!signInResponse.ok || !signIn.idToken) {
    return res.status(401).json({ message: 'Email atau kata sandi tidak cocok.' });
  }

  const { firebaseAuth } = require('../config/firebaseAdmin');
  const auth = firebaseAuth();
  const decoded = await auth.verifyIdToken(signIn.idToken, true);
  if (!['admin', 'petugas'].includes(decoded.role)) {
    return res.status(403).json({ message: 'Akun belum diberi peran petugas oleh administrator.' });
  }

  const sessionCookie = await auth.createSessionCookie(signIn.idToken, {
    expiresIn: SESSION_DURATION_MS,
  });
  res.cookie(SESSION_COOKIE, sessionCookie, cookieOptions());
  return res.json({
    user: {
      name: decoded.staffName || decoded.email || 'Petugas',
      email: decoded.email || '',
      role: decoded.role,
      unit: decoded.unit || '',
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
      const { firebaseAuth } = require('../config/firebaseAdmin');
      const auth = firebaseAuth();
      const claims = await auth.verifySessionCookie(sessionCookie);
      await auth.revokeRefreshTokens(claims.uid);
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