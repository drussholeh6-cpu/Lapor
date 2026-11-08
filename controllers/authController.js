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

async function listStaffAccounts(req, res) {
  try {
    const staff = await authService.listStaffAccounts();
    return res.json(staff);
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }
}

async function registerStaff(req, res) {
  try {
    const result = await authService.registerStaffAccount({
      name: req.body?.name,
      email: req.body?.email,
      password: req.body?.password,
      role: req.body?.role || 'petugas',
      unit: req.body?.unit || '',
    }, req.user);
    return res.status(201).json({ message: 'Akun petugas berhasil dibuat.', user: result });
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

module.exports = { listStaffAccounts, login, logout, me, registerStaff };