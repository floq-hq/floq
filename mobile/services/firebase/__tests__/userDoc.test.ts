import { describe, it, expect, beforeEach, vi } from 'vitest';

const { setDoc, getDoc } = vi.hoisted(() => ({ setDoc: vi.fn(), getDoc: vi.fn() }));

// init.ts throws at import without EXPO_PUBLIC_FIREBASE_* env — mock it.
vi.mock('../init', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  setDoc: (...args: unknown[]) => setDoc(...args),
  getDoc: (...args: unknown[]) => getDoc(...args),
  serverTimestamp: () => ({ __serverTimestamp: true }),
}));

import { ensureUserDoc } from '../userDoc';

beforeEach(() => {
  setDoc.mockReset();
  getDoc.mockReset();
});

describe('ensureUserDoc', () => {
  it('writes the users/{uid} skeleton when the doc is missing', async () => {
    getDoc.mockResolvedValue({ exists: () => false });

    await ensureUserDoc({ uid: 'u1' }, { email: 'a@b.com', display_name: 'Ada' });

    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, payload, opts] = setDoc.mock.calls[0];
    expect(ref).toEqual({ path: 'users/u1' });
    expect(payload).toEqual({
      uid: 'u1',
      email: 'a@b.com',
      display_name: 'Ada',
      created_at: { __serverTimestamp: true },
      has_seen_intro: false,
      privacy: 'private',
    });
    expect(opts).toEqual({ merge: true });
  });

  it('includes apple_id only when provided', async () => {
    getDoc.mockResolvedValue({ exists: () => false });

    await ensureUserDoc(
      { uid: 'u2' },
      { email: 'a@b.com', display_name: 'Ada', apple_id: 'apple-123' },
    );

    expect(setDoc.mock.calls[0][1]).toMatchObject({ apple_id: 'apple-123' });
  });

  it('does NOT write (no clobber) when the doc already exists', async () => {
    getDoc.mockResolvedValue({ exists: () => true });

    await ensureUserDoc({ uid: 'u3' }, { email: 'a@b.com', display_name: 'Ada' });

    expect(setDoc).not.toHaveBeenCalled();
  });
});
