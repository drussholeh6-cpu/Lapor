const { supabaseAuth } = require('../config/supabase');
const { AppError } = require('../core/errors');
const { isValidEmail, normalizeText } = require('../utils/validators');

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

async function login(email, password) {
  const normalizedEmail = normalizeText(email).toLowerCase();
  const normalizedPassword = String(password || '');

  if (!isValidEmail(normalizedEmail) || !normalizedPassword || normalizedPassword.length > 256) {
    throw new AppError('Email dan kata sandi wajib diisi.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  const auth = supabaseAuth();
  const { data, error } = await auth.auth.signInWithPassword({ email: normalizedEmail, password: normalizedPassword });

  if (error || !data?.session || !data?.user) {
    throw new AppError('Email atau kata sandi tidak cocok.', { status: 401, code: 'AUTH_INVALID_CREDENTIALS' });
  }

  const { data: userData, error: userError } = await auth.auth.getUser(data.session.access_token);
  if (userError || !userData?.user) {
    throw new AppError('Sesi tidak valid.', { status: 401, code: 'AUTH_SESSION_INVALID' });
  }

  const role = userData.user.app_metadata?.role || userData.user.user_metadata?.role;
  if (!['admin', 'petugas'].includes(role)) {
    throw new AppError('Akun belum diberi peran petugas oleh administrator.', { status: 403, code: 'AUTH_FORBIDDEN' });
  }

  return {
    sessionCookie: SESSION_COOKIE,
    cookieOptions: cookieOptions(),
    sessionToken: data.session.access_token,
    user: {
      name: userData.user.user_metadata?.staffName || userData.user.user_metadata?.name || userData.user.email || 'Petugas',
      email: userData.user.email || '',
      role,
      unit: userData.user.app_metadata?.unit || userData.user.user_metadata?.unit || '',
    },
  };
}

async function logout(sessionCookie) {
  if (sessionCookie) {
    try {
      const auth = supabaseAuth();
      await auth.auth.signOut();
    } catch {
      // ignore invalid session during logout
    }
  }

  return {
    sessionCookie: SESSION_COOKIE,
    clearCookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    },
  };
}

module.exports = {
  SESSION_COOKIE,
  cookieOptions,
  login,
  logout,
};
