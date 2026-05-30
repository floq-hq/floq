import { describe, it, expect } from 'vitest';

// init.ts throws without EXPO_PUBLIC_FIREBASE_* env, and sessionSync imports the
// firestore SDK for subscribeRemoteSessions — mock both so fromSessionDoc (pure)
// imports clean in the node env.
import { vi } from 'vitest';
vi.mock('../init', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (..._a: unknown[]) => ({}),
  onSnapshot: vi.fn(),
}));

import { fromSessionDoc } from '../sessionSync';

// A Firestore Timestamp-like value: what onSnapshot returns for a Timestamp field.
const ts = (ms: number) => ({ toMillis: () => ms });

// Mirrors a doc produced by toSessionDoc (services/session/distraction.ts). If
// that shape drifts, this fixture (and fromSessionDoc) must move with it.
function sessionDoc(over: Record<string, unknown> = {}) {
  return {
    id: 's1',
    started_at: ts(1000),
    ended_at: ts(2000),
    planned_focus_minutes: 50,
    actual_focus_minutes: 48,
    break_minutes: 11,
    distraction_count: 2,
    distraction_timestamps: [ts(1200), ts(1500)],
    task: { title: 'ship sync', difficulty: 4, est_minutes: 45 },
    focus_score: 37,
    regime: 'warming',
    client_version: '1.0.0',
    completed: true,
    overrun_minutes: 3,
    ...over,
  };
}

describe('fromSessionDoc', () => {
  it('maps a sessions/{id} doc back to a CompletedSession (Timestamps → ms)', () => {
    expect(fromSessionDoc(sessionDoc())).toEqual({
      id: 's1',
      taskId: '', // not stored in the doc
      task: { title: 'ship sync', difficulty: 4, estMinutes: 45 },
      plan: { focusMinutes: 50, breakMinutes: 11, regime: 'warming' },
      startedAt: 1000,
      endedAt: 2000,
      actualFocusMinutes: 48,
      focusScore: 37,
      distractions: [1200, 1500],
      completed: true,
      overrunMinutes: 3,
      clientVersion: '1.0.0',
    });
  });

  it('includes modelVersion only when present (mature-regime sessions)', () => {
    expect(fromSessionDoc(sessionDoc()).modelVersion).toBeUndefined();
    expect(fromSessionDoc(sessionDoc({ regime: 'mature', model_version: 'v1' })).modelVersion).toBe('v1');
  });

  it('carries a negative focus score and a saved partial (completed:false) faithfully', () => {
    const s = fromSessionDoc(sessionDoc({ focus_score: -39, completed: false }));
    expect(s.focusScore).toBe(-39);
    expect(s.completed).toBe(false);
  });

  it('handles a doc with no distractions', () => {
    const s = fromSessionDoc(sessionDoc({ distraction_count: 0, distraction_timestamps: [] }));
    expect(s.distractions).toEqual([]);
  });
});
