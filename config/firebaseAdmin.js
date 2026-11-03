const { applicationDefault, cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');

let firebaseApp;

function buildCredential() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try {
      return cert(JSON.parse(serviceAccountJson));
    } catch {
      const error = new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON.');
      error.code = 'FIREBASE_CONFIG_MISSING';
      throw error;
    }
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return applicationDefault();
  }

  const error = new Error('Missing Firebase Admin credentials. Set FIREBASE_SERVICE_ACCOUNT_JSON for Vercel or GOOGLE_APPLICATION_CREDENTIALS for local development.');
  error.code = 'FIREBASE_CONFIG_MISSING';
  throw error;
}

function getFirebaseApp() {
  if (firebaseApp) return firebaseApp;

  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!databaseURL) {
    const error = new Error('FIREBASE_DATABASE_URL is required.');
    error.code = 'FIREBASE_CONFIG_MISSING';
    throw error;
  }

  firebaseApp = getApps()[0] || initializeApp({
    credential: buildCredential(),
    databaseURL,
  });

  return firebaseApp;
}

function firebaseAuth() {
  return getAuth(getFirebaseApp());
}

function realtimeDatabase() {
  return getDatabase(getFirebaseApp());
}

module.exports = { firebaseAuth, realtimeDatabase };