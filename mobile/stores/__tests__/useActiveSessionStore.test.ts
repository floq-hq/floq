import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ActiveSession, CompletedSession } from '../../services/session/types';
import type { StartSessionInput } from '../useActiveSessionStore';

// Mock the persist module as spies (the I/O boundary) so the store's wiring is
// tested in isolation — no MMKV / react-native pulled into the node env.
const { saveActiveSession, loadActiveSession, clearActiveSession } = vi.hoisted(() => ({
  saveActiveSession: vi.fn(),
  loadActiveSession: vi.fn((): ActiveSession | null => null),
  clearActiveSession: vi.fn(),
}));

vi.mock('../../services/session/activeSessionPersist', () => ({
  ACTIVE_SESSION_KEY: 'floq.session.active',
  saveActiveSession,
  loadActiveSession,
  clearActiveSession,
}));

// Mock the SQLite session-write surface so the M4.5 abandonSession path is
// testable without expo-sqlite / firebase. Pure-side modules (finalize, overrun,
// focusScore) are not mocked — those are pure functions and we want their real
// math in the spy's payload.
const { saveCompletedSession } = vi.hoisted(() => ({
  saveCompletedSession: vi.fn<(s: CompletedSession) => void>(),
}));
vi.mock('../../services/storage/sessions', () => ({ saveCompletedSession }));

import { useActiveSessionStore } from '../useActiveSessionStore';

const input: StartSessionInput = {
  taskId: 't1',
  task: { title: 'A', difficulty: 5, estMinutes: 30 },
  plan: { focusMinutes: 51, breakMinutes: 11, regime: 'cold' },
};

beforeEach(() => {
  vi.clearAllMocks();
  loadActiveSession.mockReturnValue(null);
  useActiveSessionStore.setState({ active: null, hydrated: false });
});

describe('startSession', () => {
  it('mints a session (id, startedAt, phase struggle, no distractions) and persists it', () => {
    useActiveSessionStore.getState().startSession(input);
    const { active } = useActiveSessionStore.getState();
    expect(active?.sessionId).toBeTruthy();
    expect(typeof active?.startedAt).toBe('number');
    expect(active?.currentPhase).toBe('struggle');
    expect(active?.distractions).toEqual([]);
    expect(active?.task).toEqual(input.task);
    expect(active?.plan).toEqual(input.plan);
    expect(saveActiveSession).toHaveBeenCalledWith(active);
  });
});

describe('logDistraction', () => {
  it('appends a timestamp, increments the count, and persists each time', () => {
    const s = useActiveSessionStore.getState();
    s.startSession(input);
    s.logDistraction(1000);
    s.logDistraction(2000);
    s.logDistraction(3000);
    const { active } = useActiveSessionStore.getState();
    expect(active?.distractions).toEqual([1000, 2000, 3000]);
    expect(active?.distractions).toHaveLength(3);
    // 1 startSession + 3 logs = 4 persists
    expect(saveActiveSession).toHaveBeenCalledTimes(4);
  });

  it('no-ops (no throw, no persist) when no session is in flight', () => {
    useActiveSessionStore.getState().logDistraction(1000);
    expect(useActiveSessionStore.getState().active).toBeNull();
    expect(saveActiveSession).not.toHaveBeenCalled();
  });
});

describe('setPhase', () => {
  it('updates the current phase', () => {
    const s = useActiveSessionStore.getState();
    s.startSession(input);
    s.setPhase('flow');
    expect(useActiveSessionStore.getState().active?.currentPhase).toBe('flow');
  });
});

describe('endSession', () => {
  it('returns the snapshot, then clears active and the persisted blob', () => {
    const s = useActiveSessionStore.getState();
    s.startSession(input);
    s.logDistraction(1000);
    const ended = s.endSession();
    expect(ended?.distractions).toEqual([1000]);
    expect(useActiveSessionStore.getState().active).toBeNull();
    expect(clearActiveSession).toHaveBeenCalled();
  });
});

describe('hydrate', () => {
  it('restores the active session from a stored blob', () => {
    const stored: ActiveSession = {
      sessionId: 's9',
      taskId: 't1',
      task: { title: 'A', difficulty: 3, estMinutes: 25 },
      plan: { focusMinutes: 45, breakMinutes: 9, regime: 'cold' },
      startedAt: 500,
      currentPhase: 'release',
      distractions: [1, 2],
    };
    loadActiveSession.mockReturnValue(stored);
    useActiveSessionStore.getState().hydrate();
    expect(useActiveSessionStore.getState().active).toEqual(stored);
    expect(useActiveSessionStore.getState().hydrated).toBe(true);
  });
});

describe('abandonSession (M4.5 / L16)', () => {
  it('writes a completed:false partial with a real focus score, clears active', () => {
    const s = useActiveSessionStore.getState();
    // Start a session in the past so finalizeOnAbandon computes non-zero focus.
    const startedAt = Date.now() - 20 * 60_000;
    s.startSession(input);
    useActiveSessionStore.setState({
      active: { ...useActiveSessionStore.getState().active!, startedAt },
    });
    s.logDistraction(startedAt + 5 * 60_000);

    const partial = s.abandonSession();
    expect(partial).not.toBeNull();
    expect(partial!.completed).toBe(false);
    expect(partial!.actualFocusMinutes).toBeGreaterThan(0);
    // Pure focus-score formula ran on the real distraction count.
    expect(partial!.distractions).toHaveLength(1);
    expect(saveCompletedSession).toHaveBeenCalledWith(partial);
    expect(useActiveSessionStore.getState().active).toBeNull();
    expect(clearActiveSession).toHaveBeenCalled();
  });

  it('no-ops (no write, no throw) when no session is in flight', () => {
    const partial = useActiveSessionStore.getState().abandonSession();
    expect(partial).toBeNull();
    expect(saveCompletedSession).not.toHaveBeenCalled();
  });
});

describe('getRestorableSession (M4.5)', () => {
  it('returns whatever loadActiveSession returns (safe pre-hydration)', () => {
    const dangling: ActiveSession = {
      sessionId: 'dangling',
      taskId: 't1',
      task: input.task,
      plan: input.plan,
      startedAt: 1000,
      currentPhase: 'flow',
      distractions: [],
    };
    loadActiveSession.mockReturnValue(dangling);
    expect(useActiveSessionStore.getState().getRestorableSession()).toEqual(dangling);
  });
});
