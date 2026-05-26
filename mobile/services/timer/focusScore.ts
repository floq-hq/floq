// Focus depth score — the master outcome metric (M4.1).
//
// Pure formula from shared/spec/timer.md §"Focus depth score". Same formula in
// all three regimes. Every constant here is research-backed and FROZEN — see
// shared/spec/science.md and the safety rules in the root CLAUDE.md. Do not
// change a value without a citation and sign-off in decisions.md.
//
// No React, no I/O — this module must be unit-testable in plain Node.

import type { FocusScoreInputs } from './types';

// --- Frozen constants (science.md) ---
// Average minutes to fully recover focus after an interruption (Mark, Gloria,
// Iqbal et al., UC Irvine 2008). Not tunable — science.md Fact 2.
const DISTRACTION_PENALTY_MIN = 23;
// difficulty_mult = task_difficulty / 3.0. 3 is the midpoint of the 1–5 scale,
// so a medium task scores at face value and a hard session is worth more
// (science.md Fact 4). Not tunable.
const DIFFICULTY_PIVOT = 3.0;

/**
 * Compute the focus score for a completed session.
 *
 *   focus_score = (session_minutes − distraction_count × 23) × (difficulty / 3.0)
 *
 * Deliberately NOT clamped and NOT floored, unlike coldStart/warming:
 *   - Negative scores are meaningful feedback (a distraction-wrecked short
 *     session genuinely lost more focus than it gained) — never clamp to zero.
 *   - The score is a real-valued metric, not a minute duration, so it is not
 *     floored; e.g. (60 − 23) × 5/3 ≈ 61.67 must stay fractional.
 */
export function computeFocusScore(inputs: FocusScoreInputs): number {
  const { sessionMinutes, distractionCount, difficulty } = inputs;

  const recoveredMinutes =
    sessionMinutes - distractionCount * DISTRACTION_PENALTY_MIN;
  const difficultyMult = difficulty / DIFFICULTY_PIVOT;

  return recoveredMinutes * difficultyMult;
}
