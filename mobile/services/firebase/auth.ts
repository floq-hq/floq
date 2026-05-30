// Auth service (M2.4).
//
// SCOPE (decisions.md L13): email/password + Google are live; Apple and phone
// are scaffolded (they throw AuthNotConfiguredError until a later milestone —
// see the stubs at the bottom). The users/{uid} skeleton is written CLIENT-SIDE
// on first sign-in (ensureUserDoc) — no Cloud Function, so we stay on the free
// Spark plan.
//
// This is the one service that legitimately holds React (the useCurrentUser
// hook) and coordinates app teardown on sign-out. Persistence is Firebase's RN
// session store backed by MMKV (services/firebase/authStorage).

import { useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type Auth,
  type Persistence,
  type User,
} from 'firebase/auth';
import * as firebaseAuthNs from 'firebase/auth';
import { app } from './init';
import { ensureUserDoc } from './userDoc';
import { mmkvAuthStorage } from './authStorage';
import { useActiveSessionStore } from '../../stores/useActiveSessionStore';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import { useSettingsStore } from '../../stores/useSettingsStore';
import { useTaskStore } from '../../stores/useTaskStore';
import { queryClient } from '../queryClient';

// getReactNativePersistence is exported only from Firebase's React Native build
// (Metro resolves it via the `react-native` condition), so it exists at runtime
// but not in the web type declarations tsc resolves. Reach it through a cast.
// reason: RN-only export absent from the types tsc sees; present at runtime.
const getReactNativePersistence = (
  firebaseAuthNs as unknown as {
    getReactNativePersistence: (storage: unknown) => Persistence;
  }
).getReactNativePersistence;

// initializeAuth must run exactly once; Fast Refresh re-imports this module, so
// fall back to the already-initialized instance on the second pass.
let authInstance: Auth;
try {
  authInstance = initializeAuth(app, {
    persistence: getReactNativePersistence(mmkvAuthStorage),
  });
} catch {
  authInstance = getAuth(app);
}
export const auth = authInstance;

/** Thrown by a sign-in method that exists but isn't wired up yet (Apple/phone). */
export class AuthNotConfiguredError extends Error {
  constructor(public readonly method: 'apple' | 'phone') {
    super(`${method} sign-in is not configured yet (scaffolded for a later milestone).`);
    this.name = 'AuthNotConfiguredError';
  }
}

/** Thrown when the user dismisses the Google sheet. Callers treat it as a no-op. */
export class GoogleSignInCancelledError extends Error {
  constructor() {
    super('Google sign-in was cancelled.');
    this.name = 'GoogleSignInCancelledError';
  }
}

// --- Skeleton doc (best-effort) --------------------------------------------

/**
 * Write the `users/{uid}` skeleton, but never let a Firestore failure (offline
 * blip, transient permission glitch, quota) block a sign-in that already
 * succeeded. By the time we call this the user IS authenticated; ensureUserDoc
 * is idempotent (no-op when the doc exists), so a miss is retried lazily on the
 * next sign-in. audit #31: surfacing this as a sign-in error told the user
 * "could not continue" while they were in fact signed in.
 */
async function ensureUserDocBestEffort(
  user: Parameters<typeof ensureUserDoc>[0],
  seed: Parameters<typeof ensureUserDoc>[1],
): Promise<void> {
  try {
    await ensureUserDoc(user, seed);
  } catch (err) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn('[auth] ensureUserDoc failed (non-fatal; user is signed in)', err);
    }
  }
}

// --- Email / password ------------------------------------------------------

export async function signUp(params: {
  email: string;
  password: string;
  displayName: string;
}): Promise<User> {
  const { user } = await createUserWithEmailAndPassword(auth, params.email, params.password);
  await updateProfile(user, { displayName: params.displayName });
  await ensureUserDoc(user, { email: params.email, display_name: params.displayName });
  return user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const { user } = await signInWithEmailAndPassword(auth, email, password);
  // audit #17: the other auth paths ensure the skeleton doc; this one didn't, so
  // a returning user signing in on a new device could lack the `privacy:'private'`
  // security default + `has_seen_intro`. Best-effort so a Firestore blip never
  // blocks the (already-successful) sign-in.
  await ensureUserDocBestEffort(user, {
    email: user.email ?? email,
    display_name: user.displayName ?? 'Floq user',
  });
  return user;
}

// --- Google ----------------------------------------------------------------

type GoogleModule = typeof import('@react-native-google-signin/google-signin');
let googleConfigured = false;

/**
 * Load the Google native module lazily. A static import would touch the native
 * module at module-load time, crashing on a dev client built before this dep
 * was added — deferring it keeps the email path working until the next rebuild.
 */
function loadGoogleSignin(): Promise<GoogleModule> {
  return import('@react-native-google-signin/google-signin');
}

function configureGoogleOnce(g: GoogleModule): void {
  if (googleConfigured) return;
  g.GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  googleConfigured = true;
}

export async function signInWithGoogle(): Promise<User> {
  const g = await loadGoogleSignin();
  configureGoogleOnce(g);
  await g.GoogleSignin.hasPlayServices();
  const response = await g.GoogleSignin.signIn();
  if (!g.isSuccessResponse(response)) {
    throw new GoogleSignInCancelledError();
  }
  const { idToken, user: googleUser } = response.data;
  if (!idToken) {
    throw new Error('Google sign-in returned no idToken — check EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.');
  }
  const credential = GoogleAuthProvider.credential(idToken);
  const { user } = await signInWithCredential(auth, credential);
  // audit #31: best-effort — signInWithCredential already succeeded, so a
  // Firestore failure here must NOT propagate as a "could not continue with
  // Google" error (welcome.tsx) when the user is actually signed in.
  await ensureUserDocBestEffort(user, {
    email: user.email ?? googleUser.email ?? '',
    display_name: user.displayName ?? googleUser.name ?? 'Floq user',
  });
  return user;
}

// --- Sign out --------------------------------------------------------------

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
  // Best-effort Google session revoke. Lazy + guarded so a non-Google session
  // or a pre-rebuild client (module absent) just no-ops.
  try {
    const g = await loadGoogleSignin();
    await g.GoogleSignin.signOut();
  } catch {
    // not signed in with Google / native module unavailable — nothing to revoke
  }
  // PR4 (audit-pass): wipe ALL user-scoped client state so User A's data can
  // never bleed into User B's first screens. Each store's reset() clears its
  // in-memory state AND its MMKV blob (floq.onboarding / floq.tasks /
  // floq.settings / floq.session.active). queryClient.clear() drops the
  // TanStack cache so the next stats query rebuilds from User B's SQLite.
  //
  // The LLM cache (floq.llmCache.*) is intentionally preserved — it's derived,
  // non-PII, and survives account switches (decisions.md L13). Firebase's own
  // tokens were already cleared by firebaseSignOut above. SQLite (sessions,
  // tasks history) is per-device and is repopulated by User B's own activity;
  // we don't wipe it here because there's no per-user SQLite isolation in MVP.
  useOnboardingStore.getState().reset();
  useTaskStore.getState().reset();
  useSettingsStore.getState().reset();
  useActiveSessionStore.getState().reset();
  queryClient.clear();
}

// --- Current user hook -----------------------------------------------------

/** Subscribe to auth state. `initializing` is true until the first emission. */
export function useCurrentUser(): { user: User | null; initializing: boolean } {
  const [state, setState] = useState<{ user: User | null; initializing: boolean }>({
    user: auth.currentUser,
    initializing: true,
  });
  useEffect(
    () => onAuthStateChanged(auth, (user) => setState({ user, initializing: false })),
    [],
  );
  return state;
}

// --- Scaffolds (decisions.md L13) ------------------------------------------

/**
 * Apple Sign-In — deferred until the $99 Apple Developer membership is active.
 * Real implementation (uncomment after `expo-apple-authentication` is installed,
 * the capability is enabled, and Apple is added as a Firebase provider):
 *
 *   const cred = await AppleAuthentication.signInAsync({
 *     requestedScopes: [FULL_NAME, EMAIL],
 *     nonce: hashedNonce,
 *   });
 *   const provider = new OAuthProvider('apple.com');
 *   const credential = provider.credential({ idToken: cred.identityToken!, rawNonce });
 *   const { user } = await signInWithCredential(auth, credential);
 *   await ensureUserDoc(user, {
 *     email: user.email ?? cred.email ?? '',
 *     display_name: cred.fullName?.givenName ?? user.displayName ?? 'Floq user',
 *     apple_id: cred.user,
 *   });
 *   return user;
 */
export async function signInWithApple(): Promise<User> {
  throw new AuthNotConfiguredError('apple');
}

/**
 * Phone Auth — deferred (decisions.md L13): SMS is billed on Blaze and the
 * JS-SDK RN reCAPTCHA path is deprecated. Revisit post-MVP, likely via
 * @react-native-firebase, if still wanted.
 */
export async function signInWithPhone(): Promise<User> {
  throw new AuthNotConfiguredError('phone');
}
