import { describe, it, expect, vi } from 'vitest';

// Mock the firebase boundary so the module loads in plain node; we only exercise
// the pure toSummaryDoc projection.
vi.mock('../../firebase/init', () => ({ db: {} }));
vi.mock('../../firebase/auth', () => ({ auth: { currentUser: null } }));
vi.mock('firebase/firestore', () => ({
  doc: () => ({}),
  setDoc: vi.fn(),
  Timestamp: { fromMillis: (ms: number) => ({ __ms: ms, toMillis: () => ms }) },
}));

import { toSummaryDoc } from '../summary';
import type { CompletedSession } from '../../session/types';

const session: CompletedSession = {
  id: 's1',
  taskId: 't1',
  task: { title: 'SECRET PRIVATE TITLE', difficulty: 3, estMinutes: 50 },
  plan: { focusMinutes: 50, breakMinutes: 10, regime: 'cold' },
  startedAt: 1000,
  endedAt: 1000 + 45 * 60_000,
  actualFocusMinutes: 45,
  focusScore: 82,
  distractions: [],
  completed: true,
  overrunMinutes: 0,
  clientVersion: '1.0.0',
};

describe('toSummaryDoc', () => {
  it('projects exactly minutes/focus_score/ended_at/phase_at_end — nothing else', () => {
    const d = toSummaryDoc(session);
    expect(Object.keys(d).sort()).toEqual(['ended_at', 'focus_score', 'minutes', 'phase_at_end']);
    expect(d.minutes).toBe(45);
    expect(d.focus_score).toBe(82);
    expect(d.phase_at_end).toBe('flow');
  });

  it('STRUCTURALLY omits the task title (L4) — no task field, no title anywhere', () => {
    const d = toSummaryDoc(session);
    expect('task' in d).toBe(false);
    expect(JSON.stringify(d)).not.toContain('SECRET');
    expect(JSON.stringify(d)).not.toContain('title');
  });
});
