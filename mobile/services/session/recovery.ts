// Recovery debt (M4.7 / L17) — `recovery_mod` + the combined `depletion_mod`
// floor. Recovery is RECOMMENDED + skippable; the friction is a modeled debt
// applied to the NEXT session's recommendation, not a hard block on Start and
// never a dock to the focus score already earned.
//
// Pure, zero React. Two calibrated constants:
//   - RECOVERY_FLOOR  = 0.85  → worst-case trim when gap=0 (matches the other
//                              soft mods in coldStart: time-mismatch 0.85,
//                              hard-task 0.85)
//   - DEPLETION_FLOOR = 0.75  → joint floor on fatigue × recovery so the two
//                              positively-correlated mods don't double-count
//                              (worst corner 0.8 × 0.85 = 0.68 would clip
//                              into the 15-min clamp; the clamp is a
//                              backstop, not the mechanism)
//
// See decisions.md L17 for the magnitude rationale + sources. Both floors are
// calibrated, not frozen — revisit upward with real session data.

export const RECOVERY_FLOOR = 0.85;
export const DEPLETION_FLOOR = 0.75;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Recovery modifier given the actual gap (minutes between the prior session's
 * end and now) and the recommended break (the recomputed `breakMinutes` of the
 * prior session — see `overrun.recoveryBreakMinutes`).
 *
 *   recoveryMod = RECOVERY_FLOOR + (1 − RECOVERY_FLOOR) × clamp(gap / break, 0, 1)
 *
 * - Rested fully (`gap >= break`) → 1.0, no penalty.
 * - Restarted immediately (`gap = 0`) → RECOVERY_FLOOR (0.85), the maximum
 *   ~15% trim.
 * - No prior session in the window (caller passes a non-positive `break`, or
 *   first session of the day) → 1.0 (caller should pass 0 or a negative).
 */
export function recoveryMod(
  actualGapMin: number,
  recommendedBreakMin: number,
): number {
  if (recommendedBreakMin <= 0) return 1.0;
  const fraction = clamp(actualGapMin / recommendedBreakMin, 0, 1);
  return RECOVERY_FLOOR + (1 - RECOVERY_FLOOR) * fraction;
}

/**
 * Combined depletion modifier: floors the product of `fatigueMod` (cumulative
 * daily depletion) and `recoveryMod` (rest quality before this session) at
 * DEPLETION_FLOOR. The two are positively correlated — under-resting is part
 * of why a later same-day session is fatigued — so multiplying them without a
 * floor double-counts. The other mods (difficulty, time-match, distraction)
 * are independent constructs and multiply freely.
 */
export function depletionMod(fatigueMod: number, recoveryMod: number): number {
  return Math.max(DEPLETION_FLOOR, fatigueMod * recoveryMod);
}
