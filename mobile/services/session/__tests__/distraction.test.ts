import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { CompletedSession } from '../types';

// Mock the Firestore SDK (spies + a tiny Timestamp fake), the db handle, the
// auth instance, and the store — so distraction.ts is tested without touching
// react-native / network.
const { setDocMock, docMock } = vi.hoisted(() => ({
  setDocMock: vi.fn((..._args: unknown[]) => Promise.resolve()),
  docMock: vi.fn((_db: unknown, ...path: string[]) => ({ __path: path })),
}));
vi.mock('firebase/firestore', () => ({
  doc: docMock,
  setDoc: setDocMock,
  Timestamp: { fromMillis: (ms: number) => ({ __ts: ms }) },
}));

const { authState } = vi.hoisted(() => ({
  authState: { currentUser: null as null | { uid: string } },
}));
vi.mock('../../firebase/auth', () => ({ auth: authState }));
vi.mock('../../firebase/init', () => ({ db: {} }));

const { storeLog } = vi.hoisted(() => ({ storeLog: vi.fn() }));
vi.mock('../../../stores/useActiveSessionStore', () => ({
  useActiveSessionStore: { getState: () => ({ logDistraction: storeLog }) },
}));

import { logDistraction, toSessionDoc, writeSession } from '../distraction';

function completed(distractions: number[] = [10, 20, 30]): CompletedSession {
  return {
    id: 's1',
    taskId: 't1',
    task: { title: 'A', difficulty: 5, estMinutes: 30 },
    plan: { focusMinutes: 51, breakMinutes: 11, regime: 'cold' },
    startedAt: 1000,
    endedAt: 4000,
    actualFocusMinutes: 48,
    focusScore: -9,
    distractions,
    completed: true,
    overrunMinutes: 0,
    clientVersion: '1.0.0',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authState.currentUser = null;
});

describe('logDistraction', () => {
  it('delegates to the active-session store', () => {
    logDistraction(1234);
    expect(storeLog).toHaveBeenCalledWith(1234);
  });
});

describe('toSessionDoc', () => {
  it('maps to the schema payload: distraction count + timestamps, est_minutes, plan fields', () => {
    const out = toSessionDoc(completed([10, 20, 30]));
    expect(out.distraction_count).toBe(3);
    expect(out.distraction_timestamps).toEqual([{ __ts: 10 }, { __ts: 20 }, { __ts: 30 }]);
    expect(out.started_at).toEqual({ __ts: 1000 });
    expect(out.ended_at).toEqual({ __ts: 4000 });
    expect(out.planned_focus_minutes).toBe(51);
    expect(out.break_minutes).toBe(11);
    expect(out.regime).toBe('cold');
    expect(out.actual_focus_minutes).toBe(48);
    expect(out.focus_score).toBe(-9); // negative is preserved
    expect(out.task).toEqual({ title: 'A', difficulty: 5, est_minutes: 30 });
    expect(out.client_version).toBe('1.0.0');
    expect('model_version' in out).toBe(false); // omitted when not mature
  });

  it('includes model_version only when present', () => {
    const out = toSessionDoc({ ...completed(), modelVersion: 'v1' });
    expect(out.model_version).toBe('v1');
  });
});

describe('writeSession', () => {
  it('writes one doc to users/{uid}/sessions/{id} with the mapped payload', async () => {
    authState.currentUser = { uid: 'u1' };
    await writeSession(completed([10, 20, 30]));
    expect(docMock).toHaveBeenCalledWith({}, 'users', 'u1', 'sessions', 's1');
    expect(setDocMock).toHaveBeenCalledTimes(1);
    const payload = setDocMock.mock.calls[0][1] as { distraction_count: number };
    expect(payload.distraction_count).toBe(3);
  });

  it('throws when signed out', async () => {
    authState.currentUser = null;
    await expect(writeSession(completed())).rejects.toThrow(/no signed-in user/);
  });
});
