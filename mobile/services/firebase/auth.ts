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
  OAuthProvider,
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
import { deleteAllSessions } from '../storage/sessions';
import { deleteAllTrainingSamples } from '../storage/trainingOutbox';
import { deleteAllAnalyticsEvents } from '../storage/analyticsOutbox';
import { clearWipeMarker } from '../sync/wipeMarker';
import { writePresenceIdle } from '../presence/presence';

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

/** Thrown when the user dismisses the Apple sheet. Callers treat it as a no-op. */
export class AppleSignInCancelledError extends Error {
  constructor() {
    super('Apple sign-in was cancelled.');
    this.name = 'AppleSignInCancelledError';
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
  // M7.1: flip presence to idle while still authed — after firebaseSignOut the
  // rule denies the write (no request.auth). Best-effort; never blocks sign-out.
  try {
    await writePresenceIdle();
  } catch {
    // ignore — a failed presence write must not block sign-out
  }
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
  // tokens were already cleared by firebaseSignOut above.
  useOnboardingStore.getState().reset();
  useTaskStore.getState().reset(); // also clears the tasks SQLite table
  useSettingsStore.getState().reset();
  useActiveSessionStore.getState().reset();
  queryClient.clear();

  // Wipe the durable SQLite session history too (bug-audit-w5 #14). Reads in
  // services/storage/sessions have no uid filter and there's no per-user SQLite
  // isolation in MVP, so without this User A's sessions — hero score, forecast,
  // streak, best-session (which carries a PRIVATE task title) and cold-start
  // fatigue — would bleed into User B. Tasks are already cleared via the store
  // reset above; this closes the same hole for session history. (Full uid-column
  // isolation stays deferred.)
  deleteAllSessions();
  // L23: the local ML training outbox is also unfiltered by uid — clear it so
  // User A's un-uploaded samples never flush under User B's account.
  deleteAllTrainingSamples();
  // M7.2: same for the analytics funnel outbox — User A's un-flushed events must
  // never upload under User B (the flush also guards on uid, but clear regardless).
  deleteAllAnalyticsEvents();
  // L27: the cross-device wipe markers (floq.dataClearedAt[.self]) are device-
  // global, not uid-scoped. If they survive sign-out, User A's stale selfInitiated
  // flag can make User B's tombstone echo 'record' instead of 'wipe' (a real clear
  // is skipped → data resurrection), and a stale applied-marker can 'noop' User B's
  // legitimate clear. Reset them on every account switch.
  clearWipeMarker();
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

// --- Apple (decisions.md L13 — enabled once the Developer membership was active) ---

type AppleModule = typeof import('expo-apple-authentication');
type CryptoModule = typeof import('expo-crypto');

// Lazy native-module loads (mirrors loadGoogleSignin): a static import would
// touch native code at module-load time and crash a dev client built before
// these deps were added, breaking the email path too. Deferring keeps everything
// else working until the next rebuild ships the native modules.
function loadAppleAuth(): Promise<AppleModule> {
  return import('expo-apple-authentication');
}
function loadCrypto(): Promise<CryptoModule> {
  return import('expo-crypto');
}

/** True only where Sign in with Apple exists (iOS 13+). Drives whether the
 *  welcome screen renders the Apple button. Swallows a missing-module error
 *  (pre-rebuild client / Android) → false. */
export async function isAppleAuthAvailable(): Promise<boolean> {
  try {
    const Apple = await loadAppleAuth();
    return await Apple.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Sign in with Apple → Firebase. Uses a nonce: Apple receives the SHA-256 hash,
 * Firebase receives the raw value (replay protection, per Apple + Firebase docs).
 * Apple only returns name/email on the FIRST consent; ensureUserDoc's write-only-
 * if-missing handles re-sign-in. A dismissed sheet → AppleSignInCancelledError
 * (a UI no-op, like Google).
 */
export async function signInWithApple(): Promise<User> {
  const Apple = await loadAppleAuth();
  const Crypto = await loadCrypto();

  const rawNonce = `${Crypto.randomUUID()}${Crypto.randomUUID()}`;
  const hashedNonce = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    rawNonce,
  );

  let cred: Awaited<ReturnType<AppleModule['signInAsync']>>;
  try {
    cred = await Apple.signInAsync({
      requestedScopes: [
        Apple.AppleAuthenticationScope.FULL_NAME,
        Apple.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') {
      throw new AppleSignInCancelledError();
    }
    throw e;
  }

  if (!cred.identityToken) {
    throw new Error('Apple sign-in returned no identityToken.');
  }

  const credential = new OAuthProvider('apple.com').credential({
    idToken: cred.identityToken,
    rawNonce,
  });
  const { user } = await signInWithCredential(auth, credential);
  await ensureUserDocBestEffort(user, {
    email: user.email ?? cred.email ?? '',
    display_name: cred.fullName?.givenName ?? user.displayName ?? 'Floq user',
    apple_id: cred.user,
  });
  return user;
}

// --- Scaffolds (decisions.md L13) ------------------------------------------

/**
 * Phone Auth — deferred (decisions.md L13): SMS is billed on Blaze and the
 * JS-SDK RN reCAPTCHA path is deprecated. Revisit post-MVP, likely via
 * @react-native-firebase, if still wanted.
 */
export async function signInWithPhone(): Promise<User> {
  throw new AuthNotConfiguredError('phone');
}
