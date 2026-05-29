// Regime router (M5.2) — the three-regime dispatcher from shared/spec/ml-regimes.md.
//
// Picks cold / warming / mature from the user's LIFETIME completed-session count
// and routes to the matching recommendation engine:
//   cold    (0–4)   → computeColdStart   (pure formula, timer.md)
//   warming (5–13)  → computeWarming     (cold ⊗ behavioral blend)
//   mature  (14+)   → injected TFLite inference, else warming (defensive)
//
// PURE — zero React, zero I/O, unit-testable in plain Node (floq-timer skill).
// The mature TFLite model is M5.3 and does not exist yet, so mature inference is
// an INJECTED optional function: the router stays pure/testable now, M5.3 plugs
// in a real MatureInfer, and M5.4 passes it from computeSessionPlan — the router
// body never changes again.
//
// SCOPE (one PR, one concern — the rest is M5.4):
//  - This module returns the RAW regime recommendation only. The L17 depletion
//    mod, the L20 task-estimate cap, and the final 15/90 clamp are post-modifiers
//    that stay in services/session/compute.ts and apply ON TOP of this output.
//  - This module does NOT stamp CompletedSession.modelVersion. That is a
//    record-assembly concern (finalize.ts) and MODEL_VERSION doesn't exist until
//    M5.3. MatureInfer returns a bare SessionPlan — deliberately not widened on
//    speculation. The invariant to preserve downstream: regime === 'mature' ⟺
//    modelVersion present; a warming FALLBACK therefore reports regime 'warming'.

import { computeColdStart, computeWarming } from '../timer';
import type { BehavioralSession, SessionPlan, TimerInputs } from '../timer';

/** The recommendation engine that produced a SessionPlan. Local alias over the
 *  existing SessionPlan union — M5.2 stays self-contained (no change to the
 *  shared timer types). */
export type Regime = SessionPlan['regime']; // 'cold' | 'warming' | 'mature'

// Regime cutoffs by lifetime completed-session count (ml-regimes.md). Named so
// they can't silently drift from the spec; mirrored by warming.ts's alpha curve
// (alpha = 0 at session 14) and distinct from the forecast gate (7/14) in
// forecast.ts — the timer regime and the forecast regime are separate concepts.
export const WARMING_MIN_SESSIONS = 5;
export const MATURE_MIN_SESSIONS = 14;

/**
 * Map a lifetime completed-session count to a regime. Verbatim spec rule
 * (`< 5` cold, `< 14` warming, else mature) for every legitimate input.
 *
 * Defensive normalization first: the count is sourced (M5.4) from a SQLite
 * COUNT, but a corrupt / non-finite value must NOT misroute to the unbuilt
 * mature path — `NaN < 5` is `false`, which would otherwise fall through to
 * 'mature'. Non-finite → 0; negatives/fractions floor to a valid count.
 */
export function pickRegime(sessionsCompleted: number): Regime {
  const n = Number.isFinite(sessionsCompleted)
    ? Math.max(0, Math.floor(sessionsCompleted))
    : 0;
  if (n < WARMING_MIN_SESSIONS) return 'cold';
  if (n < MATURE_MIN_SESSIONS) return 'warming';
  return 'mature';
}

/**
 * Mature-regime inference, injected by M5.3 (TFLite). Returns a SessionPlan
 * (with `regime: 'mature'`) when the model is available, or `null` when it is
 * not (missing/failed model load). The router also guards against throws, so an
 * implementation need not catch its own native errors.
 */
export type MatureInfer = (
  inputs: TimerInputs,
  behavioral: BehavioralSession[],
) => SessionPlan | null;

/**
 * Route a session recommendation to the regime engine for the user's tenure.
 * Recomputed at every session start; pure given its arguments.
 *
 * Mature falls back to warming in all three "model unavailable" modes, so a
 * mature-tenure user is never left without a recommendation:
 *   1. `matureInfer` absent          — the M5.2 → M5.3 gap (no model wired yet)
 *   2. `matureInfer` returns `null`  — "TFLite model file missing" (acceptance)
 *   3. `matureInfer` throws          — corrupt model / native bridge error
 * The fallback plan carries `regime: 'warming'` (computeWarming's own stamp,
 * not overridden) — honest about the engine that actually ran, and it keeps the
 * `regime === 'mature' ⟺ modelVersion present` invariant intact.
 */
export function routeSessionPlan(
  inputs: TimerInputs,
  behavioral: BehavioralSession[],
  matureInfer?: MatureInfer,
): SessionPlan {
  const regime = pickRegime(inputs.sessions_completed);

  if (regime === 'cold') return computeColdStart(inputs);
  if (regime === 'warming') return computeWarming(inputs, behavioral);

  // mature: try injected inference, defensively fall back to warming.
  try {
    const mature = matureInfer?.(inputs, behavioral);
    if (mature) return mature;
  } catch {
    // fall through to warming — a throwing model must not break session start
  }
  return computeWarming(inputs, behavioral);
}
