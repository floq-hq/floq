// Warming-regime session recommendation (sessions 5–13).
//
// Blends the cold-start result with the user's behavioral averages, shifting
// linearly toward behavior as sessions accumulate. Pure formula from
// shared/spec/timer.md (warming section). The blend curve, the 0.22 break
// ratio, and the 15/90 + 5/25 clamps are research-backed and FROZEN — see
// shared/spec/science.md and the safety rules in the root CLAUDE.md.
//
// No React, no I/O — this module must be unit-testable in plain Node.

import { computeColdStart } from './coldStart';
import type { BehavioralSession, SessionPlan, TimerInputs } from './types';

// --- Frozen constants (science.md) ---
const BREAK_RATIO = 0.22; // 90/20 ultradian derivative
const FOCUS_MIN = 15; // below this, no flow possible
const FOCUS_MAX = 90; // ultradian upper bound
const BREAK_MIN = 5; // minimum useful recovery
const BREAK_MAX = 25; // beyond this, momentum lost

// Below this many task_type+hour_bucket matches, behavioral_focus falls back to
// the rolling 7-day average (timer.md warming edge case).
const MIN_MATCHING_SESSIONS = 2;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Blend weight: heavy cold-formula weight early, pure behavioral by session 14.
 * Literal spec formula (timer.md): max(0, 1 - (sessions_done - 4) / 10). No
 * upper clamp — the regime router (M5.2) only invokes warming for sessions
 * 5–13, where alpha naturally lands in [0.1, 0.9].
 */
export function warmingAlpha(sessionsDone: number): number {
  return Math.max(0, 1 - (sessionsDone - 4) / 10);
}

/**
 * Recency-weighted average of focus minutes. Sessions weigh linearly by
 * recency: the most recent of N weighs N, the oldest weighs 1 (ordered by
 * endedAt desc). science.md fixes no constant for this weighting — it is an
 * implementation choice honoring timer.md's "weighted_avg(last sessions)".
 */
function recencyWeightedFocus(sessions: BehavioralSession[]): number {
  const ordered = [...sessions].sort((a, b) => b.endedAt - a.endedAt);
  const n = ordered.length;
  let weightedSum = 0;
  let weightTotal = 0;
  ordered.forEach((s, i) => {
    const weight = n - i; // i=0 (most recent) → n, oldest → 1
    weightedSum += s.focusMinutes * weight;
    weightTotal += weight;
  });
  return weightedSum / weightTotal;
}

/**
 * behavioral_focus per the timer.md fallback chain:
 *   1. ≥2 sessions matching BOTH task_type and hour_bucket → recency-weighted avg
 *   2. else the rolling 7-day all-sessions average (history.recent_focus_avg)
 *   3. else null → caller uses the cold result alone
 */
function behavioralFocus(
  inputs: TimerInputs,
  behavioral: BehavioralSession[],
): number | null {
  const matching = behavioral.filter(
    (s) =>
      s.useCase === inputs.onboarding.use_case &&
      s.hourBucket === inputs.context.hour_bucket,
  );
  if (matching.length >= MIN_MATCHING_SESSIONS) {
    return recencyWeightedFocus(matching);
  }
  return inputs.history.recent_focus_avg; // number | null (7-day fallback)
}

/**
 * Compute the warming-regime recommendation (sessions 5–13). Recomputed at
 * every session start. Clamp/floor discipline mirrors coldStart: blend focus →
 * clamp focus → derive break from the *clamped* focus → clamp break, flooring
 * everywhere (overshooting the upper bound is worse than undershooting).
 */
export function computeWarming(
  inputs: TimerInputs,
  behavioral: BehavioralSession[],
): SessionPlan {
  const cold = computeColdStart(inputs);
  const behavioral_focus = behavioralFocus(inputs, behavioral);

  // No behavioral signal at all → cold result alone (never NaN).
  if (behavioral_focus === null) {
    return { ...cold, regime: 'warming' };
  }

  const alpha = warmingAlpha(inputs.sessions_completed);
  const blendedFocus = alpha * cold.focusMinutes + (1 - alpha) * behavioral_focus;

  const focusMinutes = Math.floor(clamp(blendedFocus, FOCUS_MIN, FOCUS_MAX));
  const breakMinutes = Math.floor(
    clamp(focusMinutes * BREAK_RATIO, BREAK_MIN, BREAK_MAX),
  );

  return { focusMinutes, breakMinutes, regime: 'warming' };
}
