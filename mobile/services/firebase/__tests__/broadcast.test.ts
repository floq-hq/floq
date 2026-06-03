import { describe, it, expect, beforeEach, vi } from 'vitest';

const {
  runTransactionMock, tx, getDoc, getDocs, setDoc, updateDoc, writeBatchMock, batch,
  logEvent, authState,
} = vi.hoisted(() => {
  const tx = { get: vi.fn(), set: vi.fn(), update: vi.fn() };
  const batch = { update: vi.fn(), commit: vi.fn(() => Promise.resolve()) };
  return {
    tx,
    batch,
    runTransactionMock: vi.fn((_db: unknown, fn: (t: unknown) => unknown) => fn(tx)),
    getDoc: vi.fn((..._a: unknown[]): Promise<unknown> => Promise.resolve()),
    getDocs: vi.fn((..._a: unknown[]): Promise<unknown> => Promise.resolve()),
    setDoc: vi.fn((..._a: unknown[]) => Promise.resolve()),
    updateDoc: vi.fn((..._a: unknown[]) => Promise.resolve()),
    writeBatchMock: vi.fn(() => batch),
    logEvent: vi.fn(),
    authState: { uid: 'me' as string | null },
  };
});

vi.mock('../init', () => ({ db: {} }));
vi.mock('../auth', () => ({
  auth: { get currentUser() { return authState.uid ? { uid: authState.uid } : null; } },
}));
vi.mock('../../analytics/logEvent', () => ({ logEvent }));
vi.mock('../partners', () => ({
  INVITE_ALPHABET: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
  INVITE_CODE_LENGTH: 6,
  normalizeCode: (raw: string) => raw.trim().toUpperCase().replace(/[\s-]+/g, ''),
}));
vi.mock('firebase/firestore', () => ({
  Timestamp: { fromMillis: (ms: number) => ({ toMillis: () => ms }) },
  collection: (_db: unknown, ...p: string[]) => ({ __col: p.join('/') }),
  doc: (_db: unknown, ...p: string[]) => ({ __doc: p.join('/') }),
  getDoc: (ref: unknown) => getDoc(ref),
  getDocs: (q: unknown) => getDocs(q),
  query: (...a: unknown[]) => ({ __query: a }),
  where: (...a: unknown[]) => ({ __where: a }),
  runTransaction: (dbArg: unknown, fn: (t: unknown) => unknown) => runTransactionMock(dbArg, fn),
  serverTimestamp: () => '__server_ts__',
  setDoc: (ref: unknown, data: unknown) => setDoc(ref, data),
  updateDoc: (ref: unknown, data: unknown) => updateDoc(ref, data),
  writeBatch: () => writeBatchMock(),
}));

import { createBroadcastCode, claimBroadcast, revokeBroadcastCode, ClaimError } from '../broadcast';

const present = (data: Record<string, unknown>) => ({ exists: () => true, data: () => data });
const missing = { exists: () => false, data: () => ({}) };
const future = () => ({ toMillis: () => Date.now() + 100_000 });
const past = () => ({ toMillis: () => Date.now() - 100_000 });

beforeEach(() => {
  authState.uid = 'me';
  tx.get.mockReset();
  tx.set.mockClear();
  tx.update.mockClear();
  batch.update.mockClear();
  batch.commit.mockClear();
  writeBatchMock.mockClear();
  getDoc.mockReset();
  getDocs.mockReset();
  setDoc.mockClear();
  updateDoc.mockClear();
  logEvent.mockClear();
});

describe('createBroadcastCode', () => {
  it('mints an active, count-0 code with a 24h TTL and returns a claim link', async () => {
    getDoc.mockResolvedValue(missing); // no collision
    const { code, link } = await createBroadcastCode();

    expect(code).toHaveLength(6);
    expect(link).toBe(`floq://claim?code=${code}`);
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, data] = setDoc.mock.calls[0];
    expect((ref as { __doc: string }).__doc).toBe(`broadcast_codes/${code}`);
    expect(data).toMatchObject({ from_uid: 'me', status: 'active', claim_count: 0 });
    expect(logEvent).toHaveBeenCalledWith('broadcast_created');
  });

  it('re-rolls on a code collision', async () => {
    getDoc.mockResolvedValueOnce(present({})).mockResolvedValueOnce(missing);
    await createBroadcastCode();
    expect(getDoc).toHaveBeenCalledTimes(2);
    expect(setDoc).toHaveBeenCalledTimes(1);
  });
});

describe('claimBroadcast', () => {
  it('claims a live under-cap code: creates the edge + bumps the counter by 1', async () => {
    tx.get
      .mockResolvedValueOnce(present({ from_uid: 'issuer', status: 'active', expires_at: future(), claim_count: 2 }))
      .mockResolvedValueOnce(missing); // edge does not exist yet

    const { edgeId, alreadyClaimed } = await claimBroadcast('abcdef');

    expect(edgeId).toBe('issuer_me');
    expect(alreadyClaimed).toBe(false);
    // edge created
    const [edgeRef, edgeData] = tx.set.mock.calls[0];
    expect((edgeRef as { __doc: string }).__doc).toBe('broadcast_edges/issuer_me');
    expect(edgeData).toMatchObject({ from_uid: 'issuer', claimer_uid: 'me', code: 'ABCDEF', status: 'active', claimed_via_broadcast: true });
    // counter bumped 2 -> 3
    const [codeRef, codePatch] = tx.update.mock.calls[0];
    expect((codeRef as { __doc: string }).__doc).toBe('broadcast_codes/ABCDEF');
    expect(codePatch).toEqual({ claim_count: 3 });
    expect(logEvent).toHaveBeenCalledWith('card_claim', { already_claimed: false }, 'broadcast');
  });

  it('is an idempotent no-op when the edge already exists (no counter bump)', async () => {
    tx.get
      .mockResolvedValueOnce(present({ from_uid: 'issuer', status: 'active', expires_at: future(), claim_count: 1 }))
      .mockResolvedValueOnce(present({ status: 'active' })); // edge already there

    const { alreadyClaimed } = await claimBroadcast('ABCDEF');

    expect(alreadyClaimed).toBe(true);
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.update).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith('card_claim', { already_claimed: true }, 'broadcast');
  });

  it('rejects self-claim', async () => {
    tx.get.mockResolvedValueOnce(present({ from_uid: 'me', status: 'active', expires_at: future(), claim_count: 0 }));
    await expect(claimBroadcast('ABCDEF')).rejects.toMatchObject({ reason: 'self-claim' });
  });

  it('rejects a revoked code', async () => {
    tx.get.mockResolvedValueOnce(present({ from_uid: 'issuer', status: 'revoked', expires_at: future(), claim_count: 0 }));
    await expect(claimBroadcast('ABCDEF')).rejects.toMatchObject({ reason: 'revoked' });
  });

  it('rejects an expired code', async () => {
    tx.get.mockResolvedValueOnce(present({ from_uid: 'issuer', status: 'active', expires_at: past(), claim_count: 0 }));
    await expect(claimBroadcast('ABCDEF')).rejects.toMatchObject({ reason: 'expired' });
  });

  it('rejects when the cap is reached', async () => {
    tx.get
      .mockResolvedValueOnce(present({ from_uid: 'issuer', status: 'active', expires_at: future(), claim_count: 5 }))
      .mockResolvedValueOnce(missing);
    await expect(claimBroadcast('ABCDEF')).rejects.toMatchObject({ reason: 'cap-reached' });
  });

  it('rejects an unknown code', async () => {
    tx.get.mockResolvedValueOnce(missing);
    await expect(claimBroadcast('ABCDEF')).rejects.toMatchObject({ reason: 'code-not-found' });
  });

  it('rejects when signed out', async () => {
    authState.uid = null;
    await expect(claimBroadcast('ABCDEF')).rejects.toBeInstanceOf(ClaimError);
  });
});

describe('revokeBroadcastCode', () => {
  it('flips the code to revoked and ends only this code\'s active edges', async () => {
    getDocs.mockResolvedValue({
      docs: [
        { ref: { __id: 'e1' }, data: () => ({ code: 'ABCDEF', status: 'active' }) },
        { ref: { __id: 'e2' }, data: () => ({ code: 'OTHER', status: 'active' }) }, // different code
        { ref: { __id: 'e3' }, data: () => ({ code: 'ABCDEF', status: 'ended' }) }, // already ended
      ],
    });

    await revokeBroadcastCode('abcdef');

    expect(updateDoc).toHaveBeenCalledTimes(1);
    const [codeRef, patch] = updateDoc.mock.calls[0];
    expect((codeRef as { __doc: string }).__doc).toBe('broadcast_codes/ABCDEF');
    expect(patch).toEqual({ status: 'revoked' });
    expect(batch.update).toHaveBeenCalledTimes(1); // only e1
    expect(batch.commit).toHaveBeenCalledTimes(1);
    expect(logEvent).toHaveBeenCalledWith('broadcast_revoked', { edges_ended: 1 });
  });

  it('does not commit a batch when there are no matching edges', async () => {
    getDocs.mockResolvedValue({ docs: [] });
    await revokeBroadcastCode('ABCDEF');
    expect(batch.commit).not.toHaveBeenCalled();
    expect(logEvent).toHaveBeenCalledWith('broadcast_revoked', { edges_ended: 0 });
  });
});
