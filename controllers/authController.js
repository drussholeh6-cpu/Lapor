const authService = require('../services/authService');

async function login(req, res) {
  try {
    const result = await authService.login(req.body?.email, req.body?.password);
    res.cookie(result.sessionCookie, result.sessionToken, result.cookieOptions);
    return res.json({ user: result.user });
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message });
  }
}

function me(req, res) {
  return res.json({ user: req.user });
}

async function logout(req, res) {
  const sessionCookie = req.cookies?.[authService.SESSION_COOKIE];

  try {
    await authService.logout(sessionCookie);
  } catch {
    // ignore logout errors and still clear the cookie
  }

  res.clearCookie(authService.SESSION_COOKIE, authService.cookieOptions());
  return res.status(204).end();
}

module.exports = { login, logout, me };