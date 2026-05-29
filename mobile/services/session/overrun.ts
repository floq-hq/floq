// Overrun + recovery-break recompute (M4.6 / L16).
//
// At Done, the recovery break is recomputed from the user's ACTUAL focus
// minutes — not the session-start suggestion. This matters when the session
// overruns (`actual > planned`): a longer focus earns a proportionally longer
// rest, on the **same frozen 0.22 ratio + 5/25 clamp** as the cold-start
// formula. No new constants here — we IMPORT the frozen ones from
// `services/timer/coldStart.ts` so the two paths can never drift.
//
// Pure, zero React. Never apply this to `phases.ts` — overrun is a UI-derived
// state on `/focus`, not a 5th phase. See decisions.md L16.

import {
  BREAK_MAX,
  BREAK_MIN,
  BREAK_RATIO,
} from '../timer/coldStart';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Minutes focused past the planned focus. Zero when the user finished at
 *  or under the suggestion. Never negative. */
export function overrunMinutes(
  actualFocusMinutes: number,
  plannedFocusMinutes: number,
): number {
  return Math.max(0, actualFocusMinutes - plannedFocusMinutes);
}

/** Recovery break (in minutes) recomputed from the actual focus minutes. Reuses
 *  the frozen `coldStart` break ratio + clamps — same formula, the only thing
 *  that changes is the input (actual minutes instead of the start suggestion).
 *  Documented in decisions.md L16 — "no new constant, no value change". */
export function recoveryBreakMinutes(actualFocusMinutes: number): number {
  const raw = Math.round(actualFocusMinutes * BREAK_RATIO);
  return clamp(raw, BREAK_MIN, BREAK_MAX);
}
