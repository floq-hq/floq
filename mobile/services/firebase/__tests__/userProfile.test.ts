import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getDoc, setDoc, updateProfile, authState } = vi.hoisted(() => ({
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateProfile: vi.fn(),
  authState: { currentUser: null as { uid: string } | null },
}));

// The barrel (./index) pulls auth.ts's initializeAuth side effect + needs env;
// mock it to plain stubs. `auth.currentUser` is driven per-test via authState.
vi.mock('../index', () => ({
  db: {},
  auth: authState,
  useCurrentUser: () => ({ user: authState.currentUser, initializing: false }),
}));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  getDoc: (...args: unknown[]) => getDoc(...args),
  setDoc: (...args: unknown[]) => setDoc(...args),
}));
vi.mock('firebase/auth', () => ({
  updateProfile: (...args: unknown[]) => updateProfile(...args),
}));

import { getUserProfile, updateDisplayName } from '../userProfile';

beforeEach(() => {
  getDoc.mockReset();
  setDoc.mockReset();
  updateProfile.mockReset();
  authState.currentUser = null;
});

describe('getUserProfile', () => {
  it('maps the users/{uid} doc and normalizes a Timestamp created_at to ms', () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        email: 'mo@floq.app',
        display_name: 'Mohamed Hiba',
        created_at: { toMillis: () => 1_700_000_000_000 },
        privacy: 'private',
      }),
    });

    return getUserProfile('u1').then((p) => {
      expect(p).toEqual({
        uid: 'u1',
        email: 'mo@floq.app',
        displayName: 'Mohamed Hiba',
        createdAt: 1_700_000_000_000,
        privacy: 'private',
      });
    });
  });

  it('accepts a numeric created_at and defaults a missing privacy to private', async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ email: 'a@b.com', display_name: 'Ada', created_at: 42 }),
    });
    const p = await getUserProfile('u2');
    expect(p?.createdAt).toBe(42);
    expect(p?.privacy).toBe('private');
  });

  it('returns null pending createdAt when the timestamp has not resolved', async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ email: 'a@b.com', display_name: 'Ada', created_at: null }),
    });
    const p = await getUserProfile('u3');
    expect(p?.createdAt).toBeNull();
  });

  it('returns null when the doc is missing', async () => {
    getDoc.mockResolvedValue({ exists: () => false });
    expect(await getUserProfile('nope')).toBeNull();
  });
});

describe('updateDisplayName', () => {
  it('writes a trimmed name to Firestore (merge) and syncs the Auth profile', async () => {
    authState.currentUser = { uid: 'u1' };
    setDoc.mockResolvedValue(undefined);
    updateProfile.mockResolvedValue(undefined);

    await updateDisplayName('u1', '  Ada Lovelace  ');

    const [ref, payload, opts] = setDoc.mock.calls[0];
    expect(ref).toEqual({ path: 'users/u1' });
    expect(payload).toEqual({ display_name: 'Ada Lovelace' });
    expect(opts).toEqual({ merge: true });
    expect(updateProfile).toHaveBeenCalledWith({ uid: 'u1' }, { displayName: 'Ada Lovelace' });
  });

  it('skips the Auth sync when there is no current user (still writes Firestore)', async () => {
    authState.currentUser = null;
    setDoc.mockResolvedValue(undefined);

    await updateDisplayName('u1', 'Ada');

    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('rejects an empty / whitespace-only name without writing', async () => {
    await expect(updateDisplayName('u1', '   ')).rejects.toThrow(/must not be empty/);
    expect(setDoc).not.toHaveBeenCalled();
  });
});
