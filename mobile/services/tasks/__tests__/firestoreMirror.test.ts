import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Task } from '../types';

// Fake Firestore batch + auth, mirroring the distraction.test.ts pattern.
const { batch, writeBatchMock, docMock, authState } = vi.hoisted(() => {
  const batch = {
    set: vi.fn(),
    delete: vi.fn(),
    commit: vi.fn(() => Promise.resolve()),
  };
  return {
    batch,
    writeBatchMock: vi.fn(() => batch),
    docMock: vi.fn((_db: unknown, ...path: string[]) => ({ __path: path.join('/') })),
    authState: { currentUser: null as null | { uid: string } },
  };
});

vi.mock('firebase/firestore', () => ({
  writeBatch: writeBatchMock,
  doc: docMock,
  Timestamp: { fromMillis: (ms: number) => ({ __ts: ms }) },
}));
vi.mock('../../firebase/auth', () => ({ auth: authState }));
vi.mock('../../firebase/init', () => ({ db: {} }));

import { mirrorTasks } from '../firestoreMirror';

function task(id: string, order: number): Task {
  return { id, title: id.toUpperCase(), difficulty: 3, estMinutes: 30, order, done: false, createdAt: order };
}

beforeEach(() => {
  batch.set.mockClear();
  batch.delete.mockClear();
  batch.commit.mockClear();
  writeBatchMock.mockClear();
  docMock.mockClear();
  authState.currentUser = null;
});

describe('mirrorTasks', () => {
  it('no-ops when signed out (no batch, no commit)', async () => {
    await mirrorTasks([], [task('a', 0)]);
    expect(writeBatchMock).not.toHaveBeenCalled();
    expect(batch.commit).not.toHaveBeenCalled();
  });

  it('upserts every current task to users/{uid}/tasks/{id} and commits', async () => {
    authState.currentUser = { uid: 'u1' };
    await mirrorTasks([], [task('a', 0), task('b', 1)]);

    expect(batch.set).toHaveBeenCalledTimes(2);
    expect(docMock).toHaveBeenCalledWith({}, 'users', 'u1', 'tasks', 'a');
    expect(batch.set).toHaveBeenCalledWith(
      { __path: 'users/u1/tasks/a' },
      expect.objectContaining({ id: 'a', title: 'A', est_minutes: 30, order: 0, done: false }),
    );
    expect(batch.delete).not.toHaveBeenCalled();
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });

  it('deletes only the ids removed since the previous queue', async () => {
    authState.currentUser = { uid: 'u1' };
    const prev = [task('a', 0), task('b', 1), task('c', 2)];
    const next = [task('a', 0)]; // b and c were removed
    await mirrorTasks(prev, next);

    expect(batch.set).toHaveBeenCalledTimes(1); // only 'a' upserted
    const deletedPaths = batch.delete.mock.calls.map((c) => (c[0] as { __path: string }).__path);
    expect(deletedPaths.sort()).toEqual(['users/u1/tasks/b', 'users/u1/tasks/c']);
    expect(batch.commit).toHaveBeenCalledTimes(1);
  });
});
