const { supabaseAdmin, supabaseAuth } = require('../config/supabase');
const { AppError } = require('../core/errors');
const { isValidEmail, normalizeText } = require('../utils/validators');

const STAFF_TABLE = 'staff_profiles';
const STAFF_UNITS = new Set([
  'Seksi Pemeliharaan Jalan',
  'Dinas Kebersihan',
  'Seksi Sarana Umum',
  'Tim Drainase',
  'Bagian Pelayanan Kelurahan',
  'Koordinasi Lintas Instansi',
]);
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

function uidForEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function listAllAuthUsers(admin) {
  const users = [];
  const perPage = 1000;
  const maxPages = 20;

  for (let page = 1; page <= maxPages; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const batch = data?.users || [];
    users.push(...batch);

    if (batch.length < perPage) break;
  }

  return users;
}

function normalizeStaffPayload(input = {}, actor = null) {
  const name = normalizeText(input.name || input.staffName || '').replace(/\s+/g, ' ');
  const email = uidForEmail(input.email || '');
  const requestedRole = ['admin', 'petugas'].includes(input.role) ? input.role : 'petugas';
  const role = actor?.role === 'admin' ? requestedRole : 'petugas';
  const unit = role === 'admin' ? '' : normalizeText(input.unit || '').replace(/\s+/g, ' ');
  return { name, email, role, unit };
}

async function getTrustedStaffProfile(user) {
  const admin = supabaseAdmin();
  const byId = await admin
    .from(STAFF_TABLE)
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!byId.error && byId.data) {
    return byId.data;
  }

  const byEmail = await admin
    .from(STAFF_TABLE)
    .select('*')
    .eq('email', String(user.email || '').trim().toLowerCase())
    .maybeSingle();

  if (byEmail.error) {
    throw byEmail.error;
  }

  return byEmail.data || null;
}

async function listStaffAccounts() {
  const admin = supabaseAdmin();
  const [users, profileResult] = await Promise.all([
    listAllAuthUsers(admin).catch(() => {
      throw new AppError('Gagal memuat akun petugas dari Supabase Auth.', { status: 500, code: 'AUTH_USERLIST_FAILED' });
    }),
    admin.from(STAFF_TABLE).select('*').order('created_at', { ascending: false }),
  ]);

  const { data: profileRows, error: profilesError } = profileResult;
  if (profilesError) {
    throw new AppError('Gagal memuat daftar profil petugas.', { status: 500, code: 'STAFF_PROFILE_READ_FAILED' });
  }

  const profiles = Array.isArray(profileRows) ? profileRows : [];
  const merged = [];
  const seen = new Set();

  for (const profile of profiles) {
    const email = uidForEmail(profile.email || '');
    if (!email || seen.has(email)) continue;
    seen.add(email);

    const authUser = users.find((user) => user.id === profile?.auth_user_id)
      || users.find((user) => uidForEmail(user.email || '') === email)
      || null;
    merged.push({
      id: profile.id || authUser?.id || email,
      email,
      name: profile.name || authUser?.user_metadata?.staffName || authUser?.user_metadata?.name || authUser?.email || profile.email,
      role: profile.role || authUser?.app_metadata?.role || authUser?.user_metadata?.role || 'petugas',
      unit: profile.unit || authUser?.app_metadata?.unit || authUser?.user_metadata?.unit || '',
      status: authUser ? 'registered' : 'pending',
      registered: Boolean(authUser),
      createdAt: profile.created_at || authUser?.created_at || null,
    });
  }

  for (const user of users) {
    const email = uidForEmail(user.email || '');
    if (!email || seen.has(email)) continue;
    seen.add(email);

    const role = user.app_metadata?.role || user.user_metadata?.role || 'petugas';
    const unit = role === 'admin' ? '' : (user.app_metadata?.unit || user.user_metadata?.unit || '');
    merged.push({
      id: user.id,
      email,
      name: user.user_metadata?.staffName || user.user_metadata?.name || user.email || 'Petugas',
      role,
      unit,
      status: 'registered',
      registered: true,
      createdAt: user.created_at || null,
    });
  }

  return merged.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
}

async function registerStaffAccount(input = {}, actor = null) {
  if (!actor || actor.role !== 'admin') {
    throw new AppError('Hanya admin yang dapat mendaftarkan akun petugas.', { status: 403, code: 'AUTH_FORBIDDEN' });
  }

  const { name, email, role, unit } = normalizeStaffPayload(input, actor);
  const password = String(input.password || '');

  if (!name || name.length < 2 || name.length > 80) {
    throw new AppError('Nama petugas harus diisi dengan benar.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  if (!isValidEmail(email)) {
    throw new AppError('Email petugas tidak valid.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  if (!password || password.length < 6 || password.length > 128) {
    throw new AppError('Kata sandi minimal 6 karakter.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  const chosenRole = ['admin', 'petugas'].includes(role) ? role : 'petugas';
  const chosenUnit = chosenRole === 'admin' ? '' : normalizeText(unit || '').replace(/\s+/g, ' ');
  if (chosenRole === 'petugas' && !STAFF_UNITS.has(chosenUnit)) {
    throw new AppError('Unit kerja petugas tidak valid.', { status: 400, code: 'VALIDATION_ERROR' });
  }

  const admin = supabaseAdmin();
  let users;
  try {
    users = await listAllAuthUsers(admin);
  } catch {
    throw new AppError('Gagal mengecek daftar petugas.', { status: 500, code: 'AUTH_USERLIST_FAILED' });
  }

  const existingUser = users.find((user) => uidForEmail(user.email || '') === email);

  if (existingUser) {
    const metadata = {
      app_metadata: {
        ...(existingUser.app_metadata || {}),
        role: chosenRole,
        unit: chosenUnit,
        staffName: name,
      },
      user_metadata: {
        ...(existingUser.user_metadata || {}),
        role: chosenRole,
        unit: chosenUnit,
        staffName: name,
        name,
      },
    };

    const { error: updateError } = await admin.auth.admin.updateUserById(existingUser.id, metadata);
    if (updateError) {
      throw new AppError('Gagal memperbarui akun petugas yang sudah ada.', { status: 500, code: 'AUTH_USER_UPDATE_FAILED' });
    }

    const { error: profileError } = await admin.from(STAFF_TABLE)
      .upsert({
        email,
        name,
        role: chosenRole,
        unit: chosenUnit,
        status: 'registered',
        auth_user_id: existingUser.id,
      }, { onConflict: 'email' });

    if (profileError) {
      throw new AppError('Gagal menyimpan profil petugas.', { status: 500, code: 'STAFF_PROFILE_WRITE_FAILED' });
    }

    return { email, name, role: chosenRole, unit: chosenUnit, status: 'registered' };
  }

  const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      staffName: name,
      role: chosenRole,
      unit: chosenUnit,
    },
    app_metadata: {
      role: chosenRole,
      unit: chosenUnit,
      staffName: name,
    },
  });

  if (createError) {
    throw new AppError(createError.message || 'Gagal membuat akun petugas baru.', { status: 400, code: 'AUTH_REGISTRATION_FAILED' });
  }

  const createdId = createdUser?.user?.id;
  if (!createdId) {
    throw new AppError('Akun petugas dibuat, tetapi ID user tidak tersedia.', { status: 500, code: 'AUTH_USER_ID_MISSING' });
  }

  const { error: profileError } = await admin.from(STAFF_TABLE)
    .upsert({
      email,
      name,
      role: chosenRole,
      unit: chosenUnit,
      status: 'registered',
      auth_user_id: createdId,
    }, { onConflict: 'email' });

  if (profileError) {
    throw new AppError('Akun dibuat, tetapi profil petugas gagal disimpan.', { status: 500, code: 'STAFF_PROFILE_WRITE_FAILED' });
  }

  return { email, name, role: chosenRole, unit: chosenUnit, status: 'registered' };
}

async function updateStaffAccount(input = {}, actor = null) {
  if (!actor || actor.role !== 'admin') {
    throw new AppError('Hanya admin yang dapat mengubah akun petugas.', { status: 403, code: 'AUTH_FORBIDDEN' });
  }

  const originalEmail = uidForEmail(input.originalEmail || '');
  const { name, email, unit } = normalizeStaffPayload({ ...input, role: 'petugas' }, actor);
  const password = input.password === undefined || input.password === null
    ? ''
    : String(input.password);

  if (!isValidEmail(originalEmail) || !isValidEmail(email) || email.length > 160) {
    throw new AppError('Email petugas tidak valid.', { status: 400, code: 'VALIDATION_ERROR' });
  }
  if (!name || name.length < 2 || name.length > 80) {
    throw new AppError('Nama petugas harus berisi 2 sampai 80 karakter.', { status: 400, code: 'VALIDATION_ERROR' });
  }
  if (!STAFF_UNITS.has(unit)) {
    throw new AppError('Unit kerja petugas harus diisi.', { status: 400, code: 'VALIDATION_ERROR' });
  }
  if (password && (password.length < 6 || password.length > 128)) {
    throw new AppError('Kata sandi baru harus berisi 6 sampai 128 karakter.', { status: 400, code: 'VALIDATION_ERROR' });
  }
  if (originalEmail === uidForEmail(actor.email)) {
    throw new AppError('Akun administrator yang sedang digunakan tidak dapat diubah dari daftar petugas.', { status: 403, code: 'STAFF_ADMIN_EDIT_FORBIDDEN' });
  }

  const admin = supabaseAdmin();
  const { data: profile, error: profileReadError } = await admin
    .from(STAFF_TABLE)
    .select('*')
    .eq('email', originalEmail)
    .maybeSingle();

  if (profileReadError) {
    throw new AppError('Gagal memeriksa profil petugas.', { status: 500, code: 'STAFF_PROFILE_READ_FAILED' });
  }

  let users;
  try {
    users = await listAllAuthUsers(admin);
  } catch {
    throw new AppError('Gagal memeriksa akun petugas.', { status: 500, code: 'AUTH_USERLIST_FAILED' });
  }

  const authUser = users.find((user) => user.id === profile?.auth_user_id)
    || users.find((user) => uidForEmail(user.email || '') === originalEmail)
    || null;
  if (!profile && !authUser) {
    throw new AppError('Akun petugas tidak ditemukan.', { status: 404, code: 'STAFF_NOT_FOUND' });
  }

  const roles = [profile?.role, authUser?.app_metadata?.role, authUser?.user_metadata?.role];
  if (roles.includes('admin')) {
    throw new AppError('Akun administrator tidak dapat diubah melalui daftar petugas.', { status: 403, code: 'STAFF_ADMIN_EDIT_FORBIDDEN' });
  }
  if (authUser && authUser.id === actor.uid) {
    throw new AppError('Akun yang sedang digunakan tidak dapat diubah di sini.', { status: 403, code: 'STAFF_SELF_EDIT_FORBIDDEN' });
  }
  if (password && !authUser) {
    throw new AppError('Petugas ini belum memiliki akun login. Buat akunnya terlebih dahulu sebelum menetapkan kata sandi.', { status: 409, code: 'STAFF_LOGIN_NOT_REGISTERED' });
  }

  const duplicateUser = users.find((user) => (
    uidForEmail(user.email || '') === email && user.id !== authUser?.id
  ));
  const { data: duplicateProfile, error: duplicateProfileError } = await admin
    .from(STAFF_TABLE)
    .select('email')
    .eq('email', email)
    .maybeSingle();
  if (duplicateProfileError) {
    throw new AppError('Gagal memeriksa email petugas.', { status: 500, code: 'STAFF_PROFILE_READ_FAILED' });
  }
  if (duplicateUser || (duplicateProfile && email !== originalEmail)) {
    throw new AppError('Email tersebut sudah digunakan akun lain.', { status: 409, code: 'STAFF_EMAIL_CONFLICT' });
  }

  if (authUser) {
    const userMetadata = {
      ...(authUser.user_metadata || {}),
      name,
      staffName: name,
      role: 'petugas',
      unit,
    };
    const appMetadata = {
      ...(authUser.app_metadata || {}),
      role: 'petugas',
      unit,
      staffName: name,
    };
    const updates = {
      email,
      email_confirm: true,
      user_metadata: userMetadata,
      app_metadata: appMetadata,
    };
    if (password) updates.password = password;

    const { error: authUpdateError } = await admin.auth.admin.updateUserById(authUser.id, updates);
    if (authUpdateError) {
      throw new AppError('Gagal memperbarui akun login petugas.', { status: 500, code: 'AUTH_USER_UPDATE_FAILED' });
    }
  }

  const profileUpdates = {
    email,
    name,
    role: 'petugas',
    unit,
    status: authUser ? 'registered' : 'pending',
    auth_user_id: authUser?.id || profile?.auth_user_id || null,
  };
  const profileWrite = profile
    ? admin.from(STAFF_TABLE).update(profileUpdates).eq('email', originalEmail)
    : admin.from(STAFF_TABLE).upsert(profileUpdates, { onConflict: 'email' });
  const { error: profileWriteError } = await profileWrite;
  if (profileWriteError) {
    throw new AppError(
      authUser
        ? 'Akun login petugas sudah diperbarui, tetapi profil belum tersimpan. Periksa kembali daftar petugas sebelum mengulangi perubahan.'
        : 'Gagal menyimpan perubahan profil petugas.',
      { status: 500, code: 'STAFF_PROFILE_WRITE_FAILED' },
    );
  }

  return { email, name, role: 'petugas', unit, status: authUser ? 'registered' : 'pending' };
}

async function deleteStaffAccount(input = {}, actor = null) {
  if (!actor || actor.role !== 'admin') {
    throw new AppError('Hanya admin yang dapat menghapus akun petugas.', { status: 403, code: 'AUTH_FORBIDDEN' });
  }

  const email = uidForEmail(input.email || '');
  if (!isValidEmail(email)) {
    throw new AppError('Email petugas tidak valid.', { status: 400, code: 'VALIDATION_ERROR' });
  }
  if (email === uidForEmail(actor.email)) {
    throw new AppError('Akun admin yang sedang digunakan tidak dapat dihapus.', { status: 400, code: 'STAFF_SELF_DELETE' });
  }

  const admin = supabaseAdmin();
  const { data: profile, error: profileReadError } = await admin
    .from(STAFF_TABLE)
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (profileReadError) {
    throw new AppError('Gagal memeriksa profil petugas.', { status: 500, code: 'STAFF_PROFILE_READ_FAILED' });
  }

  let users;
  try {
    users = await listAllAuthUsers(admin);
  } catch {
    throw new AppError('Gagal memeriksa akun petugas.', { status: 500, code: 'AUTH_USERLIST_FAILED' });
  }

  const authUser = users.find((user) => uidForEmail(user.email || '') === email) || null;
  if (!profile && !authUser) {
    throw new AppError('Akun petugas tidak ditemukan.', { status: 404, code: 'STAFF_NOT_FOUND' });
  }

  const roles = [
    profile?.role,
    authUser?.app_metadata?.role,
    authUser?.user_metadata?.role,
  ];
  if (roles.includes('admin')) {
    throw new AppError('Akun administrator tidak dapat dihapus melalui daftar petugas.', { status: 403, code: 'STAFF_ADMIN_DELETE_FORBIDDEN' });
  }

  if (authUser && authUser.id === actor.uid) {
    throw new AppError('Akun yang sedang digunakan tidak dapat dihapus.', { status: 400, code: 'STAFF_SELF_DELETE' });
  }

  if (authUser) {
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(authUser.id);
    if (authDeleteError) {
      throw new AppError('Gagal menghapus akun login petugas.', { status: 500, code: 'AUTH_USER_DELETE_FAILED' });
    }
  }

  const { error: profileDeleteError } = await admin
    .from(STAFF_TABLE)
    .delete()
    .eq('email', email);

  if (profileDeleteError) {
    throw new AppError(
      authUser
        ? 'Akun login telah dihapus, tetapi profil petugas belum terhapus. Muat ulang daftar dan ulangi penghapusan.'
        : 'Gagal menghapus profil petugas.',
      { status: 500, code: 'STAFF_PROFILE_DELETE_FAILED' },
    );
  }

  return { email };
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

  let trustedProfile;
  try {
    trustedProfile = await getTrustedStaffProfile(userData.user);
  } catch (error) {
    throw new AppError('Akun belum aktif atau belum terdaftar sebagai petugas.', { status: 403, code: 'AUTH_FORBIDDEN' });
  }

  if (!trustedProfile || trustedProfile.status !== 'registered') {
    throw new AppError('Akun belum aktif atau belum terdaftar sebagai petugas.', { status: 403, code: 'AUTH_FORBIDDEN' });
  }

  const role = trustedProfile.role;
  if (!['admin', 'petugas'].includes(role)) {
    throw new AppError('Akun belum diberi peran petugas oleh administrator.', { status: 403, code: 'AUTH_FORBIDDEN' });
  }

  return {
    sessionCookie: SESSION_COOKIE,
    cookieOptions: cookieOptions(),
    sessionToken: data.session.access_token,
    user: {
      name: trustedProfile.name || userData.user.user_metadata?.staffName || userData.user.user_metadata?.name || userData.user.email || 'Petugas',
      email: trustedProfile.email || userData.user.email || '',
      role,
      unit: trustedProfile.unit || '',
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
  deleteStaffAccount,
  listStaffAccounts,
  login,
  logout,
  registerStaffAccount,
  updateStaffAccount,
};
