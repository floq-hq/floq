import { describe, it, expect, vi } from 'vitest';

// init.ts throws without EXPO_PUBLIC_FIREBASE_* env, and taskSync imports the
// firestore SDK for subscribeRemoteTasks — mock both so the pure helpers
// (fromTaskDoc / queueUpdatedAtMs) import clean in the node env.
vi.mock('../../firebase/init', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (..._a: unknown[]) => ({}),
  onSnapshot: vi.fn(),
}));

import { fromTaskDoc, queueUpdatedAtMs } from '../taskSync';

// A Firestore Timestamp-like value (what onSnapshot returns for a Timestamp).
const ts = (ms: number) => ({ toMillis: () => ms });

// Mirrors a doc written by firestoreMirror's taskDoc.
function taskDoc(over: Record<string, unknown> = {}) {
  return {
    id: 'a',
    title: 'Refactor the auth flow',
    difficulty: 4,
    est_minutes: 90,
    order: 0,
    done: false,
    created_at: ts(1000),
    updated_at: ts(5000),
    ...over,
  };
}

describe('fromTaskDoc', () => {
  it('maps a tasks/{id} doc back to a Task', () => {
    expect(fromTaskDoc(taskDoc())).toEqual({
      id: 'a',
      title: 'Refactor the auth flow',
      difficulty: 4,
      estMinutes: 90,
      order: 0,
      done: false,
      createdAt: 1000,
    });
  });

  it('does not carry updated_at onto the Task (sync-internal only)', () => {
    expect('updatedAt' in fromTaskDoc(taskDoc())).toBe(false);
  });

  it('tolerates a legacy doc with no created_at/updated_at (→ 0 / defaults)', () => {
    const t = fromTaskDoc({ id: 'x', title: 'X', difficulty: 2, est_minutes: 15, order: 1, done: true });
    expect(t).toEqual({ id: 'x', title: 'X', difficulty: 2, estMinutes: 15, order: 1, done: true, createdAt: 0 });
  });
});

describe('queueUpdatedAtMs (LWW key)', () => {
  it('is the max updated_at across the queue', () => {
    expect(queueUpdatedAtMs([taskDoc({ updated_at: ts(3000) }), taskDoc({ id: 'b', updated_at: ts(7000) })])).toBe(7000);
  });

  it('is 0 for an empty queue (never beats a real local clock)', () => {
    expect(queueUpdatedAtMs([])).toBe(0);
  });

  it('treats legacy docs (no updated_at) as 0', () => {
    expect(queueUpdatedAtMs([{ id: 'a' }, { id: 'b' }])).toBe(0);
  });
});
