// Public API for the Firebase service. Import from here, not internals.
//
// Note: importing this barrel pulls auth.ts, which calls initializeAuth as a
// side effect. Modules that only need the pure routing helper should import
// './routing' directly.
export { app, db } from './init';
export {
  auth,
  signUp,
  signInWithEmail,
  signInWithGoogle,
  signInWithApple,
  signInWithPhone,
  signOut,
  useCurrentUser,
  AuthNotConfiguredError,
  GoogleSignInCancelledError,
} from './auth';
export { ensureUserDoc, type UserDocSeed } from './userDoc';
export { resolveStartRoute, type StartRoute } from './routing';
