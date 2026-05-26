import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ActiveSession } from '../../services/session/types';
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
