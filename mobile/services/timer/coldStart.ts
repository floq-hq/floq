// Cold-start session recommendation (regimes 0–4).
//
// Pure formula from shared/spec/timer.md. Every constant here is
// research-backed and FROZEN — see shared/spec/science.md and the safety
// rules in the root CLAUDE.md. Do not change a value without a citation
// and sign-off in decisions.md.
//
// EXPORT-ONLY LIFT (L16 / L17, 2026-05-29): the focus/break clamp + ratio
// constants are now `export const`. **No value change.** Lifted so the M4.6
// recovery-break recompute (`services/session/overrun.ts`) and the M4.7
// post-router clamp (`services/session/compute.ts`) reuse the exact frozen
// numbers — defining them twice is the drift this guards against.
//
// No React, no I/O — this module must be unit-testable in plain Node.

import type { DistractionLevel, SessionPlan, TimerInputs } from './types';

// --- Frozen constants (science.md) ---
export const BREAK_RATIO = 0.22; // 90/20 ultradian derivative
export const FOCUS_MIN = 15; // below this, no flow possible
export const FOCUS_MAX = 90; // ultradian upper bound
export const BREAK_MIN = 5; // minimum useful recovery
export const BREAK_MAX = 25; // beyond this, momentum lost

// Q2 self-report → distraction modifier.
const DISTRACTION_MOD: Record<DistractionLevel, number> = {
  easy: 0.8,
  neutral: 1.0,
  hard: 1.15,
};

// Hard tasks get a slightly shorter session (challenge–skill balance).
// difficulty is 1–5; the spec's "hard" bucket = the upper half (4–5). See
// decisions.md O8-adjacent note: 3 is the midpoint (matches focusScore's /3).
const HARD_TASK_MOD = 0.85;
const HARD_DIFFICULTY_THRESHOLD = 4;

const TIME_MATCH_MOD = 1.0;
const TIME_MISMATCH_MOD = 0.85;

// Cognitive fatigue across sessions in the same day. `sessions_today` is the
// count of sessions already completed today (0-indexed): 0 = this is the 1st.
// EXPORT-ONLY LIFT (L17, 2026-05-29): reused by `services/session/compute.ts`
// to combine with `recovery_mod` (decisions.md L17 / M4.7). No value change.
export function fatigueMod(sessionsToday: number): number {
  if (sessionsToday <= 0) return 1.0; // 1st today
  if (sessionsToday === 1) return 0.9; // 2nd today
  return 0.8; // 3rd+ today
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Compute the cold-start recommendation. Recomputed at every session start.
 *
 * Order is load-bearing (see CLAUDE.md safety rules): multiply all five
 * modifiers, clamp focus, derive break from the *clamped* focus, then clamp
 * break. Round down (Math.floor) everywhere — overshooting the upper bound is
 * worse than undershooting.
 */
export function computeColdStart(inputs: TimerInputs): SessionPlan {
  const { task, context, onboarding } = inputs;

  const distractionMod = DISTRACTION_MOD[onboarding.distraction_level];
  const difficultyMod =
    task.difficulty >= HARD_DIFFICULTY_THRESHOLD ? HARD_TASK_MOD : 1.0;
  const timeMatchMod =
    context.hour_bucket === onboarding.preferred_time
      ? TIME_MATCH_MOD
      : TIME_MISMATCH_MOD;
  const fatigue = fatigueMod(context.sessions_today);

  const rawFocus =
    onboarding.base_focus *
    distractionMod *
    difficultyMod *
    timeMatchMod *
    fatigue;

  const focusMinutes = Math.floor(clamp(rawFocus, FOCUS_MIN, FOCUS_MAX));
  const breakMinutes = Math.floor(
    clamp(focusMinutes * BREAK_RATIO, BREAK_MIN, BREAK_MAX),
  );

  return { focusMinutes, breakMinutes, regime: 'cold' };
}
