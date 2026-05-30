import { describe, it, expect, beforeEach, vi } from 'vitest';

// Every SDK / native boundary is mocked so this runs in plain node. The fake
// auth object is created inside vi.hoisted so initializeAuth can return it at
// module load (before any test body runs).
const h = vi.hoisted(() => {
  const fakeAuth = { currentUser: null };
  return {
    fakeAuth,
    initializeAuth: vi.fn(() => fakeAuth),
    getAuth: vi.fn(() => fakeAuth),
    createUser: vi.fn(),
    signInEmail: vi.fn(),
    signInCredential: vi.fn(),
    updateProfile: vi.fn(),
    fbSignOut: vi.fn(),
    onAuthStateChanged: vi.fn(),
    credential: vi.fn((token: string) => ({ __cred: token })),
    ensureUserDoc: vi.fn(),
    reset: vi.fn(),
    // PR4: signOut now resets every user-scoped store + clears the
    // TanStack cache. Each store gets its own spy so we can assert all
    // four are wiped.
    resetTasks: vi.fn(),
    resetSettings: vi.fn(),
    resetActive: vi.fn(),
    queryClientClear: vi.fn(),
    deleteAllSessions: vi.fn(),
    gConfigure: vi.fn(),
    gHasPlay: vi.fn(),
    gSignIn: vi.fn(),
    gSignOut: vi.fn(),
    isSuccess: vi.fn(),
  };
});

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: () => undefined, set: () => {}, remove: () => {} }),
}));
vi.mock('../init', () => ({ app: {} }));
vi.mock('../userDoc', () => ({ ensureUserDoc: h.ensureUserDoc }));
vi.mock('../../../stores/useOnboardingStore', () => ({
  useOnboardingStore: { getState: () => ({ reset: h.reset }) },
}));
vi.mock('../../../stores/useTaskStore', () => ({
  useTaskStore: { getState: () => ({ reset: h.resetTasks }) },
}));
vi.mock('../../../stores/useSettingsStore', () => ({
  useSettingsStore: { getState: () => ({ reset: h.resetSettings }) },
}));
vi.mock('../../../stores/useActiveSessionStore', () => ({
  useActiveSessionStore: { getState: () => ({ reset: h.resetActive }) },
}));
vi.mock('../../queryClient', () => ({
  queryClient: { clear: h.queryClientClear },
}));
vi.mock('../../storage/sessions', () => ({
  deleteAllSessions: h.deleteAllSessions,
}));
vi.mock('firebase/auth', () => ({
  initializeAuth: h.initializeAuth,
  getAuth: h.getAuth,
  createUserWithEmailAndPassword: h.createUser,
  signInWithEmailAndPassword: h.signInEmail,
  signInWithCredential: h.signInCredential,
  updateProfile: h.updateProfile,
  signOut: h.fbSignOut,
  onAuthStateChanged: h.onAuthStateChanged,
  getReactNativePersistence: vi.fn(() => ({ __persistence: true })),
  GoogleAuthProvider: { credential: h.credential },
}));
vi.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: h.gConfigure,
    hasPlayServices: h.gHasPlay,
    signIn: h.gSignIn,
    signOut: h.gSignOut,
  },
  isSuccessResponse: h.isSuccess,
}));

import {
  auth,
  signUp,
  signInWithEmail,
  signInWithGoogle,
  signInWithApple,
  signInWithPhone,
  signOut,
  AuthNotConfiguredError,
  GoogleSignInCancelledError,
} from '../auth';

beforeEach(() => vi.clearAllMocks());

describe('signUp (email)', () => {
  it('creates the user, sets the display name, and writes the skeleton doc', async () => {
    h.createUser.mockResolvedValue({ user: { uid: 'u1' } });

    const user = await signUp({ email: 'a@b.com', password: 'pw', displayName: 'Ada' });

    expect(h.createUser).toHaveBeenCalledWith(auth, 'a@b.com', 'pw');
    expect(h.updateProfile).toHaveBeenCalledWith({ uid: 'u1' }, { displayName: 'Ada' });
    expect(h.ensureUserDoc).toHaveBeenCalledWith(
      { uid: 'u1' },
      { email: 'a@b.com', display_name: 'Ada' },
    );
    expect(user).toEqual({ uid: 'u1' });
  });
});

describe('signInWithEmail', () => {
  it('delegates to the SDK and returns the user', async () => {
    h.signInEmail.mockResolvedValue({ user: { uid: 'u2' } });

    const user = await signInWithEmail('a@b.com', 'pw');

    expect(h.signInEmail).toHaveBeenCalledWith(auth, 'a@b.com', 'pw');
    expect(user).toEqual({ uid: 'u2' });
  });
});

describe('signInWithGoogle', () => {
  it('configures, exchanges the idToken for a credential, and ensures the doc', async () => {
    h.gHasPlay.mockResolvedValue(true);
    h.gSignIn.mockResolvedValue({
      type: 'success',
      data: { idToken: 'tok', user: { email: 'g@x.com', name: 'Gus' } },
    });
    h.isSuccess.mockReturnValue(true);
    h.signInCredential.mockResolvedValue({
      user: { uid: 'u3', email: 'g@x.com', displayName: 'Gus' },
    });

    const user = await signInWithGoogle();

    expect(h.gConfigure).toHaveBeenCalledTimes(1);
    expect(h.credential).toHaveBeenCalledWith('tok');
    expect(h.signInCredential).toHaveBeenCalledWith(auth, { __cred: 'tok' });
    expect(h.ensureUserDoc).toHaveBeenCalledWith(
      { uid: 'u3', email: 'g@x.com', displayName: 'Gus' },
      { email: 'g@x.com', display_name: 'Gus' },
    );
    expect(user.uid).toBe('u3');
  });

  it('throws GoogleSignInCancelledError and never exchanges a credential when dismissed', async () => {
    h.gHasPlay.mockResolvedValue(true);
    h.gSignIn.mockResolvedValue({ type: 'cancelled' });
    h.isSuccess.mockReturnValue(false);

    await expect(signInWithGoogle()).rejects.toBeInstanceOf(GoogleSignInCancelledError);
    expect(h.signInCredential).not.toHaveBeenCalled();
    expect(h.ensureUserDoc).not.toHaveBeenCalled();
  });
});

describe('signOut', () => {
  it('signs out of Firebase + Google and wipes every user-scoped store + the TanStack cache', async () => {
    h.fbSignOut.mockResolvedValue(undefined);
    h.gSignOut.mockResolvedValue(undefined);

    await signOut();

    expect(h.fbSignOut).toHaveBeenCalledWith(auth);
    expect(h.gSignOut).toHaveBeenCalledTimes(1);
    // PR4 (audit Finding #1) — the multi-store teardown. Each spy was a
    // separate bug pre-fix: User A's tasks / settings / dangling session /
    // cached stats would survive to User B's first screens.
    expect(h.reset).toHaveBeenCalledTimes(1);
    expect(h.resetTasks).toHaveBeenCalledTimes(1);
    expect(h.resetSettings).toHaveBeenCalledTimes(1);
    expect(h.resetActive).toHaveBeenCalledTimes(1);
    expect(h.queryClientClear).toHaveBeenCalledTimes(1);
    // bug-audit-w5 #14 — durable SQLite session history is wiped too, so it
    // can't leak (incl. private task titles) into the next account.
    expect(h.deleteAllSessions).toHaveBeenCalledTimes(1);
  });

  it('still wipes local state even if the Google revoke fails (non-Google session)', async () => {
    h.fbSignOut.mockResolvedValue(undefined);
    h.gSignOut.mockRejectedValue(new Error('no google session'));

    await signOut();

    expect(h.reset).toHaveBeenCalledTimes(1);
    expect(h.resetTasks).toHaveBeenCalledTimes(1);
    expect(h.resetSettings).toHaveBeenCalledTimes(1);
    expect(h.resetActive).toHaveBeenCalledTimes(1);
    expect(h.queryClientClear).toHaveBeenCalledTimes(1);
    expect(h.deleteAllSessions).toHaveBeenCalledTimes(1);
  });
});

describe('scaffolded providers (decisions.md L13)', () => {
  it('signInWithApple throws AuthNotConfiguredError("apple")', async () => {
    await expect(signInWithApple()).rejects.toMatchObject({
      name: 'AuthNotConfiguredError',
      method: 'apple',
    });
    await expect(signInWithApple()).rejects.toBeInstanceOf(AuthNotConfiguredError);
  });

  it('signInWithPhone throws AuthNotConfiguredError("phone")', async () => {
    await expect(signInWithPhone()).rejects.toMatchObject({ method: 'phone' });
  });
});
