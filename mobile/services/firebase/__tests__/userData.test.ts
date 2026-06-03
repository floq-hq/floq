import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getDocs, getDoc, writeBatchMock, batch, setDoc, serverTimestamp, setWipeSelfInitiated, deleteDoc } = vi.hoisted(
  () => {
    const batch = { delete: vi.fn(), update: vi.fn(), commit: vi.fn(() => Promise.resolve()) };
    return {
      batch,
      getDocs: vi.fn(),
      // M7.2/M7.3: the wipe reads the partner pointer (to sever the partnership +
      // clean the cross-tree reaction). Configurable per-test; the beforeEach default
      // is "solo" (no partner) so the non-partner wipe tests are unaffected.
      getDoc: vi.fn(),
      writeBatchMock: vi.fn(() => batch),
      setDoc: vi.fn((..._a: unknown[]) => Promise.resolve()),
      serverTimestamp: vi.fn(() => '__server_ts__'),
      setWipeSelfInitiated: vi.fn(),
      deleteDoc: vi.fn((..._a: unknown[]) => Promise.resolve()),
    };
  },
);

vi.mock('../init', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => ({ __path: path.join('/') }),
  doc: (_db: unknown, ...path: string[]) => ({ __doc: path.join('/') }),
  getDocs: (...a: unknown[]) => getDocs(...a),
  getDoc: (...a: unknown[]) => getDoc(...a),
  writeBatch: () => writeBatchMock(),
  deleteDoc: (...a: unknown[]) => deleteDoc(...a),
  onSnapshot: vi.fn(),
  setDoc: (...a: unknown[]) => setDoc(...a),
  serverTimestamp: () => serverTimestamp(),
}));
vi.mock('../../sync/wipeMarker', () => ({ setWipeSelfInitiated }));

import { wipeRemoteUserData } from '../userData';

function snapOf(ids: string[]) {
  return { docs: ids.map((id) => ({ ref: { __id: id } })) };
}

/** A solo pointer snapshot (no partner). */
const SOLO = { exists: () => false, data: () => ({}) };
/** A paired pointer snapshot naming `partnerUid` in pair `pairId`. */
function paired(pairId: string, partnerUid: string) {
  return { exists: () => true, data: () => ({ pair_id: pairId, partner_uid: partnerUid }) };
}

beforeEach(() => {
  getDocs.mockReset();
  getDoc.mockReset();
  getDoc.mockResolvedValue(SOLO); // default: solo unless a test opts into a partner
  batch.delete.mockClear();
  batch.update.mockClear();
  batch.commit.mockClear();
  writeBatchMock.mockClear();
  setDoc.mockClear();
  serverTimestamp.mockClear();
  setWipeSelfInitiated.mockClear();
  deleteDoc.mockClear();
});

describe('wipeRemoteUserData', () => {
  it('deletes the partner-visible projections (social/summary, social/profile, presence) so a partner cannot read a wiped user', async () => {
    getDocs.mockResolvedValue(snapOf([]));
    await wipeRemoteUserData('u1');
    const deleted = deleteDoc.mock.calls.map(([ref]) => (ref as { __doc: string }).__doc);
    expect(deleted).toContain('users/u1/social/summary');
    expect(deleted).toContain('users/u1/social/profile');
    expect(deleted).toContain('presence/u1');
  });

  it('deletes every doc in users/{uid}/sessions, /tasks, /reactions, then commits', async () => {
    // getDocs calls in order: sessions, tasks, reactions (M7.2).
    getDocs
      .mockResolvedValueOnce(snapOf(['s1', 's2']))
      .mockResolvedValueOnce(snapOf(['t1']))
      .mockResolvedValueOnce(snapOf([]));

    await wipeRemoteUserData('u1');

    expect(getDocs).toHaveBeenCalledTimes(3);
    expect(batch.delete).toHaveBeenCalledTimes(3); // s1, s2, t1
    expect(batch.commit).toHaveBeenCalled();
  });

  it('is a no-op-ish clean run when both subcollections are empty', async () => {
    getDocs.mockResolvedValue(snapOf([]));
    await wipeRemoteUserData('u1');
    expect(batch.delete).not.toHaveBeenCalled();
  });

  it('propagates a write failure (so the caller can surface it, not clear local-only)', async () => {
    getDocs.mockResolvedValueOnce(snapOf(['s1'])).mockResolvedValueOnce(snapOf([]));
    batch.commit.mockRejectedValueOnce(new Error('offline'));
    await expect(wipeRemoteUserData('u1')).rejects.toThrow(/offline/);
  });

  it('stamps the wipe tombstone (server timestamp, merged) after deleting the docs', async () => {
    getDocs.mockResolvedValue(snapOf([]));
    await wipeRemoteUserData('u1');
    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, data, opts] = setDoc.mock.calls[0];
    expect(ref).toEqual({ __doc: 'users/u1' });
    expect(data).toEqual({ data_cleared_at: '__server_ts__' });
    expect(opts).toEqual({ merge: true });
  });

  it('marks self-initiated so the originating device skips its own wipe echo', async () => {
    getDocs.mockResolvedValue(snapOf([]));
    await wipeRemoteUserData('u1');
    expect(setWipeSelfInitiated).toHaveBeenCalledTimes(1);
  });

  it('does NOT mark self-initiated or stamp the tombstone if the delete fails (offline)', async () => {
    getDocs.mockResolvedValueOnce(snapOf(['s1'])).mockResolvedValueOnce(snapOf([]));
    batch.commit.mockRejectedValueOnce(new Error('offline'));
    await expect(wipeRemoteUserData('u1')).rejects.toThrow(/offline/);
    expect(setWipeSelfInitiated).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  // M7.3 — severing the partnership (the NEVER-CUT privacy floor).
  it('severs an active partnership: flips it to ended + tears down both pointers + the cross-tree reaction', async () => {
    getDocs.mockResolvedValue(snapOf([])); // empty subcollections → the only batch is the teardown
    getDoc.mockResolvedValue(paired('p2_u1', 'p2')); // u1 is paired with p2
    await wipeRemoteUserData('u1');

    // partnerships/{pairId} flipped active → ended (consent left untouched ⇒ frozen).
    expect(batch.update).toHaveBeenCalledTimes(1);
    const [ref, data] = batch.update.mock.calls[0];
    expect(ref).toEqual({ __doc: 'partnerships/p2_u1' });
    expect(data).toEqual({ status: 'ended', ended_at: '__server_ts__' });

    // both pointers + my live reaction in p2's tree are deleted in the teardown batch.
    const torn = batch.delete.mock.calls.map(([r]) => (r as { __doc: string }).__doc);
    expect(torn).toContain('users/u1/partner/current'); // mine (owner grant)
    expect(torn).toContain('users/p2/partner/current'); // theirs (L30 cross-tree grant)
    expect(torn).toContain('users/p2/reactions/u1'); // my live reaction (reactor-delete)
    expect(batch.commit).toHaveBeenCalled();
  });

  it('does NOT run a partnership teardown when the user is solo (no pointer)', async () => {
    getDocs.mockResolvedValue(snapOf([]));
    // getDoc default is SOLO.
    await wipeRemoteUserData('u1');
    expect(batch.update).not.toHaveBeenCalled();
    expect(batch.delete).not.toHaveBeenCalled(); // no teardown + empty subcollections
  });
});
