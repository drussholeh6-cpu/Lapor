require('dotenv').config();

const { applicationDefault, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

async function main() {
  const { STAFF_EMAIL, STAFF_ROLE, STAFF_UNIT = '', STAFF_NAME = '' } = process.env;
  if (!STAFF_EMAIL || !['admin', 'petugas'].includes(STAFF_ROLE)) {
    throw new Error('Set STAFF_EMAIL dan STAFF_ROLE (admin atau petugas) terlebih dahulu.');
  }
  if (STAFF_ROLE === 'petugas' && !STAFF_UNIT) {
    throw new Error('STAFF_UNIT wajib diisi untuk role petugas.');
  }

  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!databaseURL) throw new Error('FIREBASE_DATABASE_URL belum diatur.');
  const app = getApps()[0] || initializeApp({ credential: applicationDefault(), databaseURL });
  const auth = getAuth(app);
  const user = await auth.getUserByEmail(STAFF_EMAIL);
  await auth.setCustomUserClaims(user.uid, {
    role: STAFF_ROLE,
    unit: STAFF_ROLE === 'admin' ? '' : STAFF_UNIT,
    staffName: STAFF_NAME || user.displayName || user.email,
  });
  await auth.revokeRefreshTokens(user.uid);
  console.log(`Custom claims diperbarui untuk ${user.email} (${STAFF_ROLE}).`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});