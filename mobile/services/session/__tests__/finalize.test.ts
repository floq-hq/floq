// M4.5 / M4.6 / L16 — finalizeOnDone + finalizeOnAbandon assembly.

import { describe, it, expect } from 'vitest';
import { finalizeOnAbandon, finalizeOnDone } from '../finalize';
import { computeFocusScore } from '../../timer/focusScore';
import { recoveryBreakMinutes } from '../overrun';
import type { ActiveSession } from '../types';

function makeActive(over: Partial<ActiveSession> = {}): ActiveSession {
  return {
    sessionId: 'sess-1',
    taskId: 'task-1',
    task: { title: 'ship M4.6', difficulty: 4, estMinutes: 50 },
    plan: { focusMinutes: 50, breakMinutes: 11, regime: 'cold' },
    startedAt: 1_000_000,
    currentPhase: 'flow',
    distractions: [],
    ...over,
  };
}

describe('finalizeOnDone', () => {
  it('records completed=true, real focus score, recomputed recovery break', () => {
    // 50 minutes elapsed exactly (planned 50 → no overrun).
    const endedAt = 1_000_000 + 50 * 60_000;
    const out = finalizeOnDone(makeActive(), endedAt, '1.0.0');

    expect(out.completed).toBe(true);
    expect(out.actualFocusMinutes).toBe(50);
    expect(out.overrunMinutes).toBe(0);
    expect(out.focusScore).toBe(
      computeFocusScore({ sessionMinutes: 50, distractionCount: 0, difficulty: 4 }),
    );
    // L16: the stored break is the RECOMPUTED one (from actual), not the start
    // suggestion. With actual === planned, they happen to match; the next test
    // exercises the divergent overrun case.
    expect(out.plan.breakMinutes).toBe(recoveryBreakMinutes(50));
  });

  it('records overrun_minutes and a longer recovery break when actual > planned', () => {
    // 65 minutes elapsed, planned 50 → 15-min overrun, longer recomputed break.
    const endedAt = 1_000_000 + 65 * 60_000;
    const out = finalizeOnDone(makeActive(), endedAt, '1.0.0');

    expect(out.actualFocusMinutes).toBe(65);
    expect(out.overrunMinutes).toBe(15);
    expect(out.plan.breakMinutes).toBe(recoveryBreakMinutes(65));
    // The original planned focus stays in plan.focusMinutes — it's the
    // start-time suggestion, not the actual.
    expect(out.plan.focusMinutes).toBe(50);
  });

  it('credits the focus score net of distractions', () => {
    const endedAt = 1_000_000 + 30 * 60_000;
    const out = finalizeOnDone(
      makeActive({ distractions: [1_010_000, 1_020_000] }),
      endedAt,
      '1.0.0',
    );
    expect(out.focusScore).toBe(
      computeFocusScore({ sessionMinutes: 30, distractionCount: 2, difficulty: 4 }),
    );
  });

  it('carries the captured ML feature vector through to the record (L23)', () => {
    const features = Array.from({ length: 13 }, (_, i) => i / 13);
    const active = makeActive({
      plan: { focusMinutes: 50, breakMinutes: 11, regime: 'warming', features },
    });
    const out = finalizeOnDone(active, 1_000_000 + 50 * 60_000, '1.0.0');
    expect(out.plan.features).toEqual(features);
  });

  it('omits features when the plan had none (pre-L23 / restored session)', () => {
    const out = finalizeOnDone(makeActive(), 1_000_000 + 50 * 60_000, '1.0.0');
    expect(out.plan.features).toBeUndefined();
  });
});

describe('finalizeOnAbandon', () => {
  it('records completed=false but still computes a real focus score', () => {
    const endedAt = 1_000_000 + 18 * 60_000; // 18-min partial of a 50-min plan
    const out = finalizeOnAbandon(makeActive(), endedAt, '1.0.0');

    expect(out.completed).toBe(false);
    expect(out.actualFocusMinutes).toBe(18);
    expect(out.overrunMinutes).toBe(0);
    // L16: saved partials carry a real focus score — saving means real focus
    // happened, the user just had to leave before finishing.
    expect(out.focusScore).toBe(
      computeFocusScore({ sessionMinutes: 18, distractionCount: 0, difficulty: 4 }),
    );
  });
});

// L21 — skipping recovery on sub-5-min DONEs (PR5).
describe('finalizeOnDone — sub-5-min recovery skip (L21)', () => {
  it('stores breakMinutes = 0 for a 3-min DONE (no recovery recommended)', () => {
    const endedAt = 1_000_000 + 3 * 60_000;
    const out = finalizeOnDone(makeActive(), endedAt, '1.0.0');
    expect(out.actualFocusMinutes).toBe(3);
    expect(out.plan.breakMinutes).toBe(0);
    // Focus score is still computed honestly — 3 min × difficulty 4 / 3 = 4.
    expect(out.focusScore).toBe(
      computeFocusScore({ sessionMinutes: 3, distractionCount: 0, difficulty: 4 }),
    );
  });

  it('stores breakMinutes = 5 (BREAK_MIN) at the threshold boundary (5 min)', () => {
    const endedAt = 1_000_000 + 5 * 60_000;
    const out = finalizeOnDone(makeActive(), endedAt, '1.0.0');
    expect(out.actualFocusMinutes).toBe(5);
    expect(out.plan.breakMinutes).toBe(5);
  });
});
