// Firebase client SDK init with offline persistence.
// Offline persistence is the core enabler for the volunteer kiosk on 3G:
// writes queue locally and sync automatically on reconnect (PRD §6, §8).
"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getAuth, type Auth } from "firebase/auth";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Auth/Storage are created lazily (browser only). getAuth() validates the API
// key synchronously and throws during SSR/prerender when env isn't present, so
// it must not run at module load.

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Persistent (IndexedDB) cache only exists in the browser. During SSR /
// prerender we must initialize without it, or Firestore throws in Node.
export const db: Firestore =
  typeof window === "undefined"
    ? initializeFirestore(app, {})
    : initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      });

export function getFirebaseAuth(): Auth {
  return getAuth(app);
}
export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(app);
}
