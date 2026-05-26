import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Task } from '../../tasks/types';

vi.mock('expo-sqlite', () => import('../../../test/expoSqliteFake'));

import { resetExpoSqliteFake } from '../../../test/expoSqliteFake';
import { upsertQueue, readAllTasks, countTasks, deleteAllTasks } from '../tasks';

function sample(): Task[] {
  return [
    { id: 'a', title: 'A', difficulty: 3, estMinutes: 30, order: 0, done: false, createdAt: 1 },
    { id: 'b', title: 'B', difficulty: 5, estMinutes: 60, order: 1, done: true, createdAt: 2 },
    { id: 'c', title: 'C', difficulty: 1, estMinutes: 15, order: 2, done: false, createdAt: 3 },
  ];
}

beforeEach(() => {
  resetExpoSqliteFake();
});

describe('storage/tasks', () => {
  it('upserts the queue and reads it back sorted by order', () => {
    upsertQueue(sample());
    expect(readAllTasks()).toEqual(sample());
  });

  it('round-trips the done boolean (stored as INTEGER 0/1)', () => {
    upsertQueue(sample());
    const byId = Object.fromEntries(readAllTasks().map((t) => [t.id, t.done]));
    expect(byId).toEqual({ a: false, b: true, c: false });
  });

  it('orders by "order", not insertion order', () => {
    upsertQueue([
      { id: 'x', title: 'X', difficulty: 2, estMinutes: 20, order: 2, done: false, createdAt: 1 },
      { id: 'y', title: 'Y', difficulty: 2, estMinutes: 20, order: 0, done: false, createdAt: 2 },
      { id: 'z', title: 'Z', difficulty: 2, estMinutes: 20, order: 1, done: false, createdAt: 3 },
    ]);
    expect(readAllTasks().map((t) => t.id)).toEqual(['y', 'z', 'x']);
  });

  it('replaces the whole queue — no stale rows from a prior write', () => {
    upsertQueue(sample());
    upsertQueue([
      { id: 'b', title: 'B2', difficulty: 4, estMinutes: 45, order: 0, done: false, createdAt: 2 },
    ]);
    const tasks = readAllTasks();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ id: 'b', title: 'B2', order: 0 });
    expect(countTasks()).toBe(1);
  });

  it('countTasks reflects the persisted count', () => {
    expect(countTasks()).toBe(0);
    upsertQueue(sample());
    expect(countTasks()).toBe(3);
  });

  it('deleteAllTasks empties the table', () => {
    upsertQueue(sample());
    deleteAllTasks();
    expect(readAllTasks()).toEqual([]);
    expect(countTasks()).toBe(0);
  });
});
