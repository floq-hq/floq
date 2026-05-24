/**
 * Firebase initialization (M1.4).
 *
 * Initializes the Firebase app exactly once (guards against Fast Refresh
 * re-init) and exports the Firestore handle. Config comes from
 * `EXPO_PUBLIC_FIREBASE_*` env vars — the JS SDK configures from the web app
 * config object, NOT `GoogleService-Info.plist` (that's a native-SDK artifact).
 * See `mobile/.env.example`. These keys ship to the client and are not secret,
 * but live in `.env` so they aren't hard-coded per environment.
 *
 * Auth is intentionally NOT set up here. It lives in `services/firebase/auth.ts`
 * (M2.4), which adds React Native persistence. This module is Firestore-only.
 */
import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';

const config: FirebaseOptions = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Fail loud and early if env is missing — a half-configured Firebase otherwise
// fails in confusing async ways deep inside the first read/write.
const missing = Object.entries(config)
  .filter(([, value]) => !value)
  .map(([key]) => key);
if (missing.length > 0) {
  throw new Error(
    `Firebase config missing env var(s): ${missing.join(', ')}. ` +
      `Copy mobile/.env.example to mobile/.env and fill in the floq-prod web app config.`,
  );
}

export const app = getApps().length ? getApp() : initializeApp(config);
export const db: Firestore = getFirestore(app);
