require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

async function main() {
  const { STAFF_EMAIL, STAFF_ROLE, STAFF_UNIT = '', STAFF_NAME = '' } = process.env;
  if (!STAFF_EMAIL || !['admin', 'petugas'].includes(STAFF_ROLE)) {
    throw new Error('Set STAFF_EMAIL dan STAFF_ROLE (admin atau petugas) terlebih dahulu.');
  }
  if (STAFF_ROLE === 'petugas' && !STAFF_UNIT) {
    throw new Error('STAFF_UNIT wajib diisi untuk role petugas.');
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY harus diatur.');
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: usersData, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  const user = usersData.users.find((item) => item.email?.toLowerCase() === STAFF_EMAIL.toLowerCase());
  if (!user) {
    throw new Error(`Pengguna ${STAFF_EMAIL} tidak ditemukan di Supabase Auth.`);
  }

  const roleData = {
    app_metadata: {
      ...user.app_metadata,
      role: STAFF_ROLE,
      unit: STAFF_ROLE === 'admin' ? '' : STAFF_UNIT,
      staffName: STAFF_NAME || user.user_metadata?.staffName || user.email,
    },
    user_metadata: {
      ...user.user_metadata,
      role: STAFF_ROLE,
      unit: STAFF_ROLE === 'admin' ? '' : STAFF_UNIT,
      staffName: STAFF_NAME || user.user_metadata?.staffName || user.email,
    },
  };

  const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, roleData);
  if (updateError) throw updateError;

  console.log(`Peran petugas diperbarui untuk ${user.email} (${STAFF_ROLE}).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});