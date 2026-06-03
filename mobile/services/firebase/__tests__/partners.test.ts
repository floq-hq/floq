import { describe, it, expect, beforeEach, vi } from 'vitest';

// --- Mocks: every SDK boundary replaced so this runs in plain node. ---
const h = vi.hoisted(() => ({
  auth: { currentUser: { uid: 'aaa' } as { uid: string } | null },
  getDoc: vi.fn(),
  setDoc: vi.fn(),
  updateDoc: vi.fn(),
  // tx.get reads from here; writes are captured in `writes`.
  txDocs: new Map<string, unknown>(),
  writes: [] as Array<[op: string, path: string, data?: unknown]>,
  batchOps: [] as Array<[op: string, path: string, data?: unknown]>,
  projectDisplayName: vi.fn(() => Promise.resolve()),
  logEvent: vi.fn(),
}));

vi.mock('../init', () => ({ db: {} }));
vi.mock('../auth', () => ({ auth: h.auth }));
// Stub the M7.1 name projection so its fire-and-forget setDoc doesn't pollute the
// setDoc assertions here; the projection itself is tested in social/__tests__.
vi.mock('../../social/profile', () => ({ projectDisplayName: h.projectDisplayName }));
// Stub the M7.2 analytics so logEvent calls are observable + firebase-free.
vi.mock('../../analytics/logEvent', () => ({ logEvent: h.logEvent }));

vi.mock('firebase/firestore', () => {
  const snapFor = (path: string) => ({
    exists: () => h.txDocs.has(path),
    data: () => h.txDocs.get(path),
  });
  return {
    doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
    getDoc: (ref: { path: string }) => h.getDoc(ref),
    setDoc: (...a: unknown[]) => h.setDoc(...a),
    updateDoc: (...a: unknown[]) => h.updateDoc(...a),
    serverTimestamp: () => ({ __server: true }),
    Timestamp: { fromMillis: (ms: number) => ({ toMillis: () => ms }) },
    runTransaction: (_db: unknown, fn: (tx: unknown) => unknown) =>
      fn({
        get: (ref: { path: string }) => Promise.resolve(snapFor(ref.path)),
        set: (ref: { path: string }, data: unknown) => h.writes.push(['set', ref.path, data]),
        update: (ref: { path: string }, data: unknown) => h.writes.push(['update', ref.path, data]),
      }),
    writeBatch: () => ({
      update: (ref: { path: string }, data: unknown) => h.batchOps.push(['update', ref.path, data]),
      delete: (ref: { path: string }) => h.batchOps.push(['delete', ref.path]),
      commit: () => Promise.resolve(),
    }),
  };
});

import {
  normalizeCode,
  pairIdOf,
  createInvite,
  revokeInvite,
  acceptInvite,
  removePartner,
  blockPartner,
  setShareConsent,
  AcceptError,
  INVITE_ALPHABET,
} from '../partners';

const A = 'aaa'; // me
const B = 'bbb'; // inviter (sorts after me)
const CODE = 'ABCDEF';
const future = { toMillis: () => Date.now() + 60_000 };

function pendingInvite(from = B, overrides: Record<string, unknown> = {}) {
  return { code: CODE, from_uid: from, status: 'pending', expires_at: future, ...overrides };
}

beforeEach(() => {
  h.auth.currentUser = { uid: A };
  h.getDoc.mockReset();
  h.setDoc.mockReset();
  h.updateDoc.mockReset();
  h.txDocs.clear();
  h.writes.length = 0;
  h.batchOps.length = 0;
  h.projectDisplayName.mockClear();
  h.logEvent.mockClear();
});

describe('normalizeCode', () => {
  it('uppercases, strips spaces/dashes, accepts a valid 6-char code', () => {
    expect(normalizeCode(' ab-cd ef ')).toBe('ABCDEF');
  });
  it('rejects the wrong length', () => {
    expect(() => normalizeCode('ABCDE')).toThrow(AcceptError);
    expect(() => normalizeCode('ABCDEFG')).toThrow(AcceptError);
  });
  it('rejects off-alphabet characters (the excluded I/O/0/1 confusables)', () => {
    for (const bad of ['ABCDEI', 'ABCDEO', 'ABCDE0', 'ABCDE1']) {
      expect(() => normalizeCode(bad)).toThrow(AcceptError);
    }
  });
  it('every generated alphabet symbol is accepted', () => {
    expect(INVITE_ALPHABET.length).toBe(32);
    expect(() => normalizeCode(INVITE_ALPHABET.slice(0, 6))).not.toThrow();
  });
});

describe('pairIdOf', () => {
  it('is sorted and order-independent', () => {
    expect(pairIdOf(A, B)).toBe('aaa_bbb');
    expect(pairIdOf(B, A)).toBe('aaa_bbb');
  });
});

describe('createInvite', () => {
  it('re-rolls on a collision then writes a pending invite + returns the link', async () => {
    h.getDoc
      .mockResolvedValueOnce({ exists: () => true }) // first code collides
      .mockResolvedValueOnce({ exists: () => false }); // second is free

    const { code, link } = await createInvite();

    expect(h.getDoc).toHaveBeenCalledTimes(2);
    expect(h.setDoc).toHaveBeenCalledTimes(1);
    const [, payload] = h.setDoc.mock.calls[0];
    expect(payload).toMatchObject({ code, from_uid: A, status: 'pending' });
    expect(payload.expires_at.toMillis()).toBeGreaterThan(Date.now());
    expect(link).toBe(`floq://pair?code=${code}`);
  });

  it('throws when not signed in', async () => {
    h.auth.currentUser = null;
    await expect(createInvite()).rejects.toThrow(AcceptError);
  });
});

describe('revokeInvite', () => {
  it('updates the normalized invite to revoked', async () => {
    await revokeInvite(' abc-def ');
    expect(h.updateDoc).toHaveBeenCalledTimes(1);
    const [ref, payload] = h.updateDoc.mock.calls[0];
    expect(ref).toEqual({ path: 'partner_invites/ABCDEF' });
    expect(payload).toEqual({ status: 'revoked' });
  });
});

describe('acceptInvite — rejections', () => {
  it('code-not-found', async () => {
    await expect(acceptInvite(CODE)).rejects.toMatchObject({ reason: 'code-not-found' });
  });
  it('self-pair', async () => {
    h.txDocs.set(`partner_invites/${CODE}`, pendingInvite(A));
    await expect(acceptInvite(CODE)).rejects.toMatchObject({ reason: 'self-pair' });
  });
  it('revoked', async () => {
    h.txDocs.set(`partner_invites/${CODE}`, pendingInvite(B, { status: 'revoked' }));
    await expect(acceptInvite(CODE)).rejects.toMatchObject({ reason: 'revoked' });
  });
  it('expired by status', async () => {
    h.txDocs.set(`partner_invites/${CODE}`, pendingInvite(B, { status: 'expired' }));
    await expect(acceptInvite(CODE)).rejects.toMatchObject({ reason: 'expired' });
  });
  it('expired by time', async () => {
    h.txDocs.set(`partner_invites/${CODE}`, pendingInvite(B, { expires_at: { toMillis: () => Date.now() - 1 } }));
    await expect(acceptInvite(CODE)).rejects.toMatchObject({ reason: 'expired' });
  });
  it('my pointer already exists → already-paired', async () => {
    h.txDocs.set(`partner_invites/${CODE}`, pendingInvite());
    h.txDocs.set(`users/${A}/partner/current`, { pair_id: 'x', partner_uid: 'z' });
    await expect(acceptInvite(CODE)).rejects.toMatchObject({ reason: 'already-paired' });
  });
  it("inviter's pointer already exists → inviter-already-paired", async () => {
    h.txDocs.set(`partner_invites/${CODE}`, pendingInvite());
    h.txDocs.set(`users/${B}/partner/current`, { pair_id: 'x', partner_uid: 'z' });
    await expect(acceptInvite(CODE)).rejects.toMatchObject({ reason: 'inviter-already-paired' });
  });
  it('ended partnership → ended', async () => {
    h.txDocs.set(`partner_invites/${CODE}`, pendingInvite());
    h.txDocs.set('partnerships/aaa_bbb', { status: 'ended', members: [A, B] });
    await expect(acceptInvite(CODE)).rejects.toMatchObject({ reason: 'ended' });
  });
});

describe('acceptInvite — idempotency + success', () => {
  it('returns a no-op when the same active partnership already exists', async () => {
    h.txDocs.set(`partner_invites/${CODE}`, pendingInvite());
    h.txDocs.set('partnerships/aaa_bbb', { status: 'active', members: [A, B] });
    const r = await acceptInvite(CODE);
    expect(r).toEqual({ pairId: 'aaa_bbb', alreadyPaired: true });
    expect(h.writes).toHaveLength(0); // pure no-op
  });

  it('creates the partnership, both pointers, and flips the invite', async () => {
    h.txDocs.set(`partner_invites/${CODE}`, pendingInvite());
    const r = await acceptInvite(CODE);

    expect(r).toEqual({ pairId: 'aaa_bbb', alreadyPaired: false });
    const byPath = Object.fromEntries(h.writes.map(([op, path, data]) => [path, { op, data }]));

    expect(byPath['partnerships/aaa_bbb']).toMatchObject({
      op: 'set',
      data: { members: [A, B], status: 'active', pair_streak_days: 0, invite_code: CODE, share_consent: {} },
    });
    // M7.1: the accepter projects their own name after the pairing commits.
    expect(h.projectDisplayName).toHaveBeenCalledTimes(1);
    expect(byPath[`users/${A}/partner/current`].data).toMatchObject({
      pair_id: 'aaa_bbb', partner_uid: B, invite_code: CODE,
    });
    expect(byPath[`users/${B}/partner/current`].data).toMatchObject({
      pair_id: 'aaa_bbb', partner_uid: A, invite_code: CODE,
    });
    expect(byPath[`partner_invites/${CODE}`]).toMatchObject({
      op: 'update', data: { status: 'accepted', accepted_by: A },
    });
  });
});

describe('removePartner / blockPartner', () => {
  it('removePartner ends the partnership and deletes both pointers (no block)', async () => {
    h.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ pair_id: 'aaa_bbb', partner_uid: B }),
    });
    await removePartner();

    const update = h.batchOps.find(([op]) => op === 'update');
    expect(update?.[1]).toBe('partnerships/aaa_bbb');
    expect(update?.[2]).toMatchObject({ status: 'ended' });
    expect((update?.[2] as Record<string, unknown>).blocked_by).toBeUndefined();
    const deletes = h.batchOps.filter(([op]) => op === 'delete').map(([, p]) => p);
    expect(deletes).toEqual([
      `users/${A}/partner/current`,
      `users/${B}/partner/current`,
      `users/${B}/reactions/${A}`, // M7.2: tear down my reaction in the ex-partner's tree
    ]);
  });

  it('blockPartner additionally stamps blocked_by = me', async () => {
    h.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ pair_id: 'aaa_bbb', partner_uid: B }),
    });
    await blockPartner();
    const update = h.batchOps.find(([op]) => op === 'update');
    expect(update?.[2]).toMatchObject({ status: 'ended', blocked_by: A });
  });

  it('removePartner is a no-op when already solo', async () => {
    h.getDoc.mockResolvedValueOnce({ exists: () => false });
    await removePartner();
    expect(h.batchOps).toHaveLength(0);
  });
});

describe('setShareConsent (M7.1)', () => {
  it('updates only my own key via dot-path', async () => {
    h.getDoc.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ pair_id: 'aaa_bbb', partner_uid: B }),
    });
    await setShareConsent(true);
    expect(h.updateDoc).toHaveBeenCalledTimes(1);
    const [ref, payload] = h.updateDoc.mock.calls[0];
    expect(ref).toEqual({ path: 'partnerships/aaa_bbb' });
    expect(payload).toEqual({ 'share_consent.aaa': true });
  });

  it('is a no-op when solo (no pointer)', async () => {
    h.getDoc.mockResolvedValueOnce({ exists: () => false });
    await setShareConsent(true);
    expect(h.updateDoc).not.toHaveBeenCalled();
  });
});

describe('createInvite projects the inviter name (M7.1)', () => {
  it('fires projectDisplayName after writing the invite', async () => {
    h.getDoc.mockResolvedValueOnce({ exists: () => false }); // no collision
    await createInvite();
    expect(h.projectDisplayName).toHaveBeenCalledTimes(1);
  });
});

describe('M7.2 analytics funnel events', () => {
  it('createInvite fires invite_created', async () => {
    h.getDoc.mockResolvedValueOnce({ exists: () => false });
    await createInvite();
    expect(h.logEvent).toHaveBeenCalledWith('invite_created');
  });

  it('acceptInvite fires invite_accepted with already_paired:false on a fresh pair', async () => {
    h.txDocs.set(`partner_invites/${CODE}`, pendingInvite());
    await acceptInvite(CODE);
    expect(h.logEvent).toHaveBeenCalledWith('invite_accepted', { already_paired: false });
  });

  it('acceptInvite fires invite_accepted with already_paired:true on the idempotent no-op', async () => {
    h.txDocs.set(`partner_invites/${CODE}`, pendingInvite());
    h.txDocs.set('partnerships/aaa_bbb', { status: 'active', members: [A, B] });
    await acceptInvite(CODE);
    expect(h.logEvent).toHaveBeenCalledWith('invite_accepted', { already_paired: true });
  });

  it('setShareConsent fires consent_set with the value', async () => {
    h.getDoc.mockResolvedValueOnce({ exists: () => true, data: () => ({ pair_id: 'aaa_bbb', partner_uid: B }) });
    await setShareConsent(true);
    expect(h.logEvent).toHaveBeenCalledWith('consent_set', { value: true });
  });
});
