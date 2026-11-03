const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

let db = null;
const databaseURL = process.env.FIREBASE_DATABASE_URL;
if (!databaseURL) {
  console.warn('FIREBASE_DATABASE_URL is not set. Firebase Admin SDK is not initialized.');
} else {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  let credential = null;

  if (serviceAccountJson) {
    try {
      credential = admin.credential.cert(JSON.parse(serviceAccountJson));
    } catch (error) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON.');
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credential = admin.credential.applicationDefault();
  }

  if (credential) {
    admin.initializeApp({
      credential,
      databaseURL,
    });
    db = getFirestore();
    console.log('Koneksi ke Firebase berhasil dikonfigurasi!');
  }
}

module.exports = { db };
