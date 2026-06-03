import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mocks: replace every SDK boundary so getPartnerStatus runs in plain node. ---
// Smoke-tests the S7.1 read path: name resolves from social/profile, and `dormant`
// is derived from social/summary EXISTENCE (not a field on summary) — the fix this
// PR makes over S7.0's stale assumed shape.
const h = vi.hoisted(() => ({
  // path -> doc data (absent key = doc doesn't exist); special value `REJECT` throws.
  docs: new Map<string, unknown>(),
  inviteCode: null as string | null,
  clearMyInviteCode: vi.fn(),
}));

const REJECT = Symbol('reject');

vi.mock('../../firebase', () => ({ db: {}, useCurrentUser: () => ({ user: { uid: 'me' } }) }));
vi.mock('../localInvite', () => ({
  getMyInviteCode: () => h.inviteCode,
  clearMyInviteCode: h.clearMyInviteCode,
}));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  getDoc: (ref: { path: string }) => {
    const v = h.docs.get(ref.path);
    if (v === REJECT) return Promise.reject(new Error('permission-denied'));
    return Promise.resolve({ exists: () => h.docs.has(ref.path), data: () => v });
  },
}));

import { getPartnerStatus } from '../usePartnerStatus';

beforeEach(() => {
  h.docs.clear();
  h.inviteCode = null;
  h.clearMyInviteCode.mockClear();
});

describe('getPartnerStatus (S7.1 read path)', () => {
  it('paired + partner has a profile name + a summary → not dormant, name from profile', async () => {
    h.docs.set('users/me/partner/current', { pair_id: 'me_p', partner_uid: 'p', since: 123 });
    h.docs.set('users/p/social/profile', { display_name: 'Sara Khan' });
    h.docs.set('users/p/social/summary', { minutes: 50, focus_score: 82 });

    const s = await getPartnerStatus('me');
    expect(s).toMatchObject({
      state: 'paired',
      partnerUid: 'p',
      partnerName: 'Sara Khan',
      dormant: false,
    });
  });

  it('paired but no summary yet → dormant true (name still resolves)', async () => {
    h.docs.set('users/me/partner/current', { pair_id: 'me_p', partner_uid: 'p' });
    h.docs.set('users/p/social/profile', { display_name: 'Sara Khan' });
    // no users/p/social/summary

    const s = await getPartnerStatus('me');
    expect(s).toMatchObject({ state: 'paired', partnerName: 'Sara Khan', dormant: true });
  });

  it('paired but the profile/summary reads are denied → degrades, does not throw', async () => {
    h.docs.set('users/me/partner/current', { pair_id: 'me_p', partner_uid: 'p' });
    h.docs.set('users/p/social/profile', REJECT);
    h.docs.set('users/p/social/summary', REJECT);

    const s = await getPartnerStatus('me');
    expect(s).toMatchObject({ state: 'paired', partnerName: null, dormant: true });
  });

  it('no pointer + no minted invite → solo', async () => {
    const s = await getPartnerStatus('me');
    expect(s).toEqual({ state: 'solo' });
  });
});
