// Overrun + recovery-break recompute (M4.6 / L16 / L21).
//
// At Done, the recovery break is recomputed from the user's ACTUAL focus
// minutes — not the session-start suggestion. This matters when the session
// overruns (`actual > planned`): a longer focus earns a proportionally longer
// rest, on the **same frozen 0.22 ratio + 5/25 clamp** as the cold-start
// formula. No new constants for the formula itself — we IMPORT the frozen
// ones from `services/timer/coldStart.ts` so the two paths can never drift.
//
// L21 (PR5): below MIN_FOCUS_FOR_RECOVERY the break is **0** (no recovery
// recommended). The cold-start 5-min break floor was calibrated assuming the
// user actually did real focus work (FOCUS_MIN = 15+ min); below ~5 min the
// user expended too little cognitive resource to need a 5-min break. The
// summary screen reads 0 as the "skip recovery" sentinel and routes straight
// to Home — clean reuse of the PR4 #6 bail-out plumbing.
//
// Pure, zero React. Never apply this to `phases.ts` — overrun is a UI-derived
// state on `/focus`, not a 5th phase. See decisions.md L16.

import {
  BREAK_MAX,
  BREAK_MIN,
  BREAK_RATIO,
} from '../timer/coldStart';

/** Below this many actual focused minutes, no recovery is recommended at all
 *  (the formula returns 0 instead of the BREAK_MIN floor). L21 — calibrated,
 *  revisit with real-usage data. The PR4 #6 / L21 bail in /recovery + the
 *  session-summary auto-route both treat `breakMinutes <= 0` as "skip recovery". */
export const MIN_FOCUS_FOR_RECOVERY = 5;

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

/** Recovery break (in minutes) recomputed from the actual focus minutes.
 *  - `actual < MIN_FOCUS_FOR_RECOVERY` → 0 (no recovery, see L21 above).
 *  - else: reuses the frozen `coldStart` break ratio + clamps — same formula,
 *    the only thing that changes is the input (actual minutes instead of the
 *    start suggestion). Documented in decisions.md L16.
 */
export function recoveryBreakMinutes(actualFocusMinutes: number): number {
  if (actualFocusMinutes < MIN_FOCUS_FOR_RECOVERY) return 0;
  const raw = Math.round(actualFocusMinutes * BREAK_RATIO);
  return clamp(raw, BREAK_MIN, BREAK_MAX);
}
