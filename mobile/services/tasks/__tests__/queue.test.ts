import { describe, it, expect } from 'vitest';
import type { Task } from '../types';
import {
  hiddenCount,
  insert,
  insertMany,
  markDone,
  promoteNext,
  removeTask,
  reorder,
  topTask,
  updateTask,
} from '../queue';

// Build a Task with sensible defaults; title encodes identity for readable asserts.
function t(id: string, order: number, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title: id.toUpperCase(),
    difficulty: 3,
    estMinutes: 30,
    order,
    done: false,
    createdAt: 1000,
    ...overrides,
  };
}

/** orders must be contiguous 0..n-1 and the array sorted by order. */
function expectContiguous(tasks: Task[]): void {
  expect(tasks.map((x) => x.order)).toEqual(tasks.map((_, i) => i));
}

describe('insert', () => {
  it('appends to the bottom and renumbers', () => {
    const result = insert([t('a', 0), t('b', 1)], t('c', 99));
    expect(result.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expectContiguous(result);
  });

  it('sorts an unordered input before appending', () => {
    const result = insert([t('b', 5), t('a', 1)], t('c', 0));
    expect(result.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expectContiguous(result);
  });

  it('handles an empty queue', () => {
    const result = insert([], t('a', 7));
    expect(result.map((x) => x.id)).toEqual(['a']);
    expect(result[0].order).toBe(0);
  });
});

describe('insertMany', () => {
  it('appends a batch in given order and renumbers', () => {
    const result = insertMany([t('a', 0)], [t('b', 0), t('c', 0)]);
    expect(result.map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expectContiguous(result);
  });

  it('preserves batch order for the brain-dump case (empty start)', () => {
    const result = insertMany([], [t('x', 0), t('y', 0), t('z', 0)]);
    expect(result.map((x) => x.id)).toEqual(['x', 'y', 'z']);
    expectContiguous(result);
  });
});

describe('updateTask', () => {
  it('edits title/difficulty/estMinutes and preserves order/id/createdAt/done', () => {
    const before = [t('a', 0), t('b', 1)];
    const result = updateTask(before, 'b', { title: 'New', difficulty: 5, estMinutes: 90 });
    const b = result.find((x) => x.id === 'b')!;
    expect(b).toMatchObject({ title: 'New', difficulty: 5, estMinutes: 90, order: 1, createdAt: 1000, done: false });
  });

  it('is a no-op for an unknown id', () => {
    const before = [t('a', 0)];
    expect(updateTask(before, 'zzz', { title: 'x' })).toEqual(before);
  });
});

describe('reorder', () => {
  it('moves a task down and renumbers', () => {
    const result = reorder([t('a', 0), t('b', 1), t('c', 2)], 0, 2);
    expect(result.map((x) => x.id)).toEqual(['b', 'c', 'a']);
    expectContiguous(result);
  });

  it('moves a task up and renumbers', () => {
    const result = reorder([t('a', 0), t('b', 1), t('c', 2)], 2, 0);
    expect(result.map((x) => x.id)).toEqual(['c', 'a', 'b']);
    expectContiguous(result);
  });

  it('is a no-op when from === to', () => {
    const before = [t('a', 0), t('b', 1)];
    expect(reorder(before, 1, 1).map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('is a no-op when an index is out of range', () => {
    const before = [t('a', 0), t('b', 1)];
    expect(reorder(before, 0, 5).map((x) => x.id)).toEqual(['a', 'b']);
    expect(reorder(before, -1, 0).map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('markDone (auto-promote next)', () => {
  it('drops the completed top task and promotes the next to order 0', () => {
    const result = markDone([t('a', 0), t('b', 1), t('c', 2)], 'a');
    expect(result.map((x) => x.id)).toEqual(['b', 'c']);
    expect(topTask(result)!.id).toBe('b');
    expectContiguous(result);
  });

  it('returns [] when the completed task was the last one', () => {
    expect(markDone([t('a', 0)], 'a')).toEqual([]);
  });

  it('is a no-op for an unknown id (still contiguous)', () => {
    const result = markDone([t('a', 0), t('b', 1)], 'zzz');
    expect(result.map((x) => x.id)).toEqual(['a', 'b']);
    expectContiguous(result);
  });
});

describe('removeTask', () => {
  it('removes an arbitrary (non-top) task and renumbers', () => {
    const result = removeTask([t('a', 0), t('b', 1), t('c', 2)], 'b');
    expect(result.map((x) => x.id)).toEqual(['a', 'c']);
    expectContiguous(result);
  });
});

describe('promoteNext', () => {
  it('drops the current top and renumbers', () => {
    const result = promoteNext([t('a', 0), t('b', 1)]);
    expect(result.map((x) => x.id)).toEqual(['b']);
    expect(result[0].order).toBe(0);
  });

  it('returns [] on an empty queue', () => {
    expect(promoteNext([])).toEqual([]);
  });
});

describe('topTask', () => {
  it('returns the order-0 task', () => {
    expect(topTask([t('b', 1), t('a', 0)])!.id).toBe('a');
  });

  it('returns null on an empty queue', () => {
    expect(topTask([])).toBeNull();
  });
});

describe('hiddenCount', () => {
  it('is length-1 for a non-empty queue, 0 for empty/single', () => {
    expect(hiddenCount([])).toBe(0);
    expect(hiddenCount([t('a', 0)])).toBe(0);
    expect(hiddenCount([t('a', 0), t('b', 1), t('c', 2)])).toBe(2);
  });
});
