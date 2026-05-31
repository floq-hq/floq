import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getDocs, writeBatchMock, batch, setDoc, serverTimestamp, setWipeSelfInitiated } = vi.hoisted(
  () => {
    const batch = { delete: vi.fn(), commit: vi.fn(() => Promise.resolve()) };
    return {
      batch,
      getDocs: vi.fn(),
      writeBatchMock: vi.fn(() => batch),
      setDoc: vi.fn((..._a: unknown[]) => Promise.resolve()),
      serverTimestamp: vi.fn(() => '__server_ts__'),
      setWipeSelfInitiated: vi.fn(),
    };
  },
);

vi.mock('../init', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => ({ __path: path.join('/') }),
  doc: (_db: unknown, ...path: string[]) => ({ __doc: path.join('/') }),
  getDocs: (...a: unknown[]) => getDocs(...a),
  writeBatch: () => writeBatchMock(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  setDoc: (...a: unknown[]) => setDoc(...a),
  serverTimestamp: () => serverTimestamp(),
}));
vi.mock('../../sync/wipeMarker', () => ({ setWipeSelfInitiated }));

import { wipeRemoteUserData } from '../userData';

function snapOf(ids: string[]) {
  return { docs: ids.map((id) => ({ ref: { __id: id } })) };
}

beforeEach(() => {
  getDocs.mockReset();
  batch.delete.mockClear();
  batch.commit.mockClear();
  writeBatchMock.mockClear();
  setDoc.mockClear();
  serverTimestamp.mockClear();
  setWipeSelfInitiated.mockClear();
});

describe('wipeRemoteUserData', () => {
  it('deletes every doc in users/{uid}/sessions and /tasks, then commits', async () => {
    // First getDocs call = sessions, second = tasks.
    getDocs.mockResolvedValueOnce(snapOf(['s1', 's2'])).mockResolvedValueOnce(snapOf(['t1']));

    await wipeRemoteUserData('u1');

    expect(getDocs).toHaveBeenCalledTimes(2);
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
});
