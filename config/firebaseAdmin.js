const { applicationDefault, cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');

let firebaseApp;

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;

  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!databaseURL) {
    const error = new Error('FIREBASE_DATABASE_URL is required.');
    error.code = 'FIREBASE_CONFIG_MISSING';
    throw error;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  let credential = applicationDefault();
  if (serviceAccountJson) {
    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      const error = new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON.');
      error.code = 'FIREBASE_CONFIG_MISSING';
      throw error;
    }
    credential = cert(serviceAccount);
  }

  firebaseApp = getApps()[0] || initializeApp({ credential, databaseURL });
  return firebaseApp;
}

function firebaseAuth() {
  return getAuth(getFirebaseApp());
}

function realtimeDatabase() {
  return getDatabase(getFirebaseApp());
}

module.exports = { firebaseAuth, realtimeDatabase };