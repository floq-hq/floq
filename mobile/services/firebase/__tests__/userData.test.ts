import { describe, it, expect, beforeEach, vi } from 'vitest';

const { getDocs, writeBatchMock, batch } = vi.hoisted(() => {
  const batch = { delete: vi.fn(), commit: vi.fn(() => Promise.resolve()) };
  return { batch, getDocs: vi.fn(), writeBatchMock: vi.fn(() => batch) };
});

vi.mock('../init', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...path: string[]) => ({ __path: path.join('/') }),
  getDocs: (...a: unknown[]) => getDocs(...a),
  writeBatch: () => writeBatchMock(),
  deleteDoc: vi.fn(),
}));

import { wipeRemoteUserData } from '../userData';

function snapOf(ids: string[]) {
  return { docs: ids.map((id) => ({ ref: { __id: id } })) };
}

beforeEach(() => {
  getDocs.mockReset();
  batch.delete.mockClear();
  batch.commit.mockClear();
  writeBatchMock.mockClear();
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
});
