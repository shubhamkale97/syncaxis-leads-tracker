const admin = require('firebase-admin');

// One Admin SDK instance per warm serverless instance (Vercel reuses these between
// invocations), so this only actually runs cold-start, not on every request.
let app;
function getAdminApp() {
  if (!app) {
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
      throw new Error(
        'Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY env vars — ' +
        'set these in the Vercel project settings from a service account key you generate in the ' +
        'Firebase console (Project Settings -> Service Accounts -> Generate New Private Key).'
      );
    }
    app = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }
  return app;
}

function db() {
  getAdminApp();
  return admin.firestore();
}

module.exports = { admin, getAdminApp, db };
