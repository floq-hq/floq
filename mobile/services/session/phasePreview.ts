/**
 * Phase-journey preview (Session launchpad).
 *
 * Derives the ordered flow phases a plan will traverse — Struggle → Release →
 * Flow — proportioned in minutes, so the launchpad can preview the *shape* of
 * the upcoming session instead of repeating Home's recommendation ring.
 *
 * Pure, React-free, unit-tested. The frozen `phaseFor()` (services/timer/phases)
 * is the single source of truth for the boundaries — we SAMPLE it minute by
 * minute rather than hardcoding 20/21 here, so if a boundary ever changes (with
 * sign-off) this preview follows automatically and stays honest.
 *
 * Focus-side only: a plan whose `focusMinutes` is clamped low (e.g. 16) never
 * reaches Flow, and the segments collapse to just Struggle — that's a real,
 * useful signal, not an error. The break/recovery is drawn separately by the
 * component from `plan.breakMinutes`; it is not a focus-phase segment here.
 */
import { phaseFor, type Phase, type SessionPlan } from '../timer';

export interface PhaseSegment {
  phase: Phase;
  minutes: number;
}

/**
 * The contiguous Struggle/Release/Flow segments the plan moves through, summing
 * to `plan.focusMinutes`. Empty if `focusMinutes <= 0`. O(focusMinutes) and
 * focusMinutes ≤ 90, so it's trivial — call it once (memoized), never on a tick.
 */
export function previewPhases(plan: SessionPlan): PhaseSegment[] {
  const segments: PhaseSegment[] = [];
  const focusMinutes = Math.max(0, Math.floor(plan.focusMinutes));

  for (let m = 0; m < focusMinutes; m += 1) {
    // Sample at the START of each minute. Recovery only triggers at
    // elapsed >= focusMinutes*60, so m < focusMinutes never yields 'recovery'.
    const phase = phaseFor(m * 60, plan);
    const last = segments[segments.length - 1];
    if (last && last.phase === phase) {
      last.minutes += 1;
    } else {
      segments.push({ phase, minutes: 1 });
    }
  }

  return segments;
}
