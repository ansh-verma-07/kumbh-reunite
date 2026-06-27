// Firebase Admin SDK init (server only), lazily initialized so the build's
// page-data collection step never constructs it without credentials.
import "server-only";

import { initializeApp, getApps, cert, type App, type AppOptions } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";

let _db: Firestore | null = null;

export function getAdminDb(): Firestore {
  if (_db) return _db;

  const opts: AppOptions = {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  };
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64) {
    opts.credential = cert(JSON.parse(Buffer.from(b64, "base64").toString("utf8")));
  }
  // If no b64, the Admin SDK uses GOOGLE_APPLICATION_CREDENTIALS / ADC.

  const app: App = getApps().length ? getApps()[0] : initializeApp(opts);
  _db = getFirestore(app);
  return _db;
}

let _auth: Auth | null = null;
export function getAdminAuth(): Auth {
  if (_auth) return _auth;
  // Reuse the already-initialised app.
  getAdminDb(); // ensures app is initialised
  _auth = getAuth(getApps()[0]);
  return _auth;
}
