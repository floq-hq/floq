// Session-end assembly (M4.5 / M4.6 / L16).
//
// One place that turns an in-flight ActiveSession into the on-disk
// CompletedSession at session-end — used by both the DONE path (`finalizeOnDone`,
// /focus) and the end-early / restore-save path (`finalizeOnAbandon`, the M4.5
// store action + restore.ts).
//
// Centralizing this means the focus score, the recomputed recovery break, and
// the overrun number are computed exactly once — `/focus` and the abandon
// callers can't drift apart. Pure assembly; no I/O.

import { computeFocusScore } from '../timer/focusScore';
import type { ActiveSession, CompletedSession } from './types';
import { overrunMinutes, recoveryBreakMinutes } from './overrun';
import { MODEL_VERSION } from '../ml/modelVersion';

/** Wall-clock minutes between two epoch-ms timestamps, rounded to nearest. */
function minutesBetween(startMs: number, endMs: number): number {
  return Math.max(0, Math.round((endMs - startMs) / 60_000));
}

function assemble(
  active: ActiveSession,
  endedAt: number,
  clientVersion: string,
  completed: boolean,
): CompletedSession {
  const actualFocusMinutes = minutesBetween(active.startedAt, endedAt);
  const planned = active.plan.focusMinutes;
  const overrun = overrunMinutes(actualFocusMinutes, planned);
  const focusScore = computeFocusScore({
    sessionMinutes: actualFocusMinutes,
    distractionCount: active.distractions.length,
    difficulty: active.task.difficulty,
  });
  // Recovery break is recomputed from the ACTUAL minutes (L16) — the original
  // plan's breakMinutes was based on the start-time suggestion. The recomputed
  // figure REPLACES `plan.breakMinutes` on the stored record so downstream
  // readers (recovery UI, M4.7 gap clock) see one consistent number.
  const recomputedBreak = recoveryBreakMinutes(actualFocusMinutes);

  return {
    id: active.sessionId,
    taskId: active.taskId,
    task: active.task,
    plan: {
      focusMinutes: planned,
      breakMinutes: recomputedBreak,
      regime: active.plan.regime,
      // L23: carry the captured feature vector through to the training outbox
      // (assemble rebuilds plan, so it would otherwise be dropped here).
      ...(active.plan.features ? { features: active.plan.features } : {}),
    },
    startedAt: active.startedAt,
    endedAt,
    actualFocusMinutes,
    focusScore,
    distractions: active.distractions,
    completed,
    overrunMinutes: overrun,
    clientVersion,
    // M5.3: stamp the model version ONLY when the mature TFLite model produced
    // the plan, upholding the `regime === 'mature' ⟺ modelVersion present`
    // invariant (regimeRouter.ts). Cold/warming plans carry no modelVersion.
    ...(active.plan.regime === 'mature' ? { modelVersion: MODEL_VERSION } : {}),
  };
}

/** Build the CompletedSession for a DONE-tapped session. `completed: true`. */
export function finalizeOnDone(
  active: ActiveSession,
  endedAt: number,
  clientVersion: string,
): CompletedSession {
  return assemble(active, endedAt, clientVersion, true);
}

/** Build the CompletedSession for an end-early / restore-save partial.
 *  `completed: false`. Same focus-score formula as DONE — saving a partial
 *  credits the real focus that happened (L16 invariant). */
export function finalizeOnAbandon(
  active: ActiveSession,
  endedAt: number,
  clientVersion: string,
): CompletedSession {
  return assemble(active, endedAt, clientVersion, false);
}
