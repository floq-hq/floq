// Session compute orchestrator (M3.3 + M4.7).
//
// Turns "user tapped START on task X" into a concrete SessionPlan. This is the
// orchestration layer ABOVE the frozen timer service: it gathers live inputs
// (onboarding answers, the chosen task, current context), assembles a
// TimerInputs, and runs the regime router — then hands back the plan. It READS
// the timer service; it never modifies it.
//
// M4.7 (L17): a depletion debt is applied here, as a post-modifier on the
// regime-router output. The recovery effect is operationalized AS the
// `context.hours_since_last` input the timer.md Inputs table already listed —
// it lives here, NOT inside coldStart.ts (frozen). The cold-start constants
// stay untouched; this layer reads them through the export-only lifts in
// coldStart.ts (BREAK_RATIO, FOCUS_MIN/MAX, BREAK_MIN/MAX, fatigueMod).
//
// W3 was cold-only. From M4.7 the cold path runs through the same `dmod`
// adjustment — for a first session of the day (no prior session inside the
// recovery window) the modifier is 1.0, so behavior is unchanged.

import {
  BREAK_MAX,
  BREAK_MIN,
  BREAK_RATIO,
  FOCUS_MAX,
  FOCUS_MIN,
  computeColdStart,
  fatigueMod,
} from '../timer/coldStart';
import type { HourBucket, SessionPlan, TimerInputs } from '../timer';
import { toOnboardingSeed } from '../onboarding/seed';
import type { OnboardingAnswers } from '../onboarding/types';
import type { Task } from '../tasks';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import { useTaskStore } from '../../stores/useTaskStore';
import {
  countSessionsToday,
  getLastSessionEndedAt,
  getRecentSessions,
} from '../storage/sessions';
import { depletionMod, recoveryMod } from './recovery';

type DayOfWeek = TimerInputs['context']['day_of_week']; // 0..6 (Sun..Sat)

// Live inputs to computeSessionPlan. `sessionsToday` now has a real source
// (M4.2: counted from SQLite when omitted — see computeSessionPlan); the rest
// are still defaulted until their sources land. `now` is injectable so the
// hour-bucket/decay derivation and the today-count are deterministic under test.
// `recoveryGapMin` + `recommendedBreakMin` are injectable too so the M4.7
// `recovery_mod` path stays deterministic under unit test (the defaults pull
// from SQLite via getLastSessionEndedAt + the prior row's break_minutes).
export interface SessionComputeContext {
  now?: number; // default Date.now()
  sessionsToday?: number; // default: countSessionsToday(now) from SQLite (M4.2)
  hoursSinceLast?: number; // default 24
  history?: { recent_focus_avg: number | null; recent_distract: number | null };
  recoveryGapMin?: number; // default: derived from getLastSessionEndedAt()
  recommendedBreakMin?: number; // default: derived from the previous session's break_minutes
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

// Local-time → hour bucket. Cutoffs: morning 05:00–11:59, afternoon
// 12:00–16:59, evening 17:00–20:59, night 21:00–04:59. onboarding's
// preferred_time is only morning/afternoon/evening, so a 'night' start never
// matches the time preference — off-peak for everyone, by design.
//
// This is wall-clock bucketing (matches timer.md Inputs table). A proposed
// circadian-relative model (bucket by hours-since-waking, not clock) is logged
// as decisions.md O10 — it would replace ONLY this function (behind the same
// computeSessionPlan ctx) once a wake-time input exists.
export function hourBucket(date: Date): HourBucket {
  const h = date.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

/**
 * Assemble the full TimerInputs for a session. Pure and deterministic given
 * `ctx.now` — no stores, no I/O. The cold-start formula reads difficulty,
 * distraction_level, hour_bucket vs preferred_time, and sessions_today; the
 * remaining fields are populated for shape-completeness and the later regimes.
 */
export function buildSessionInputs(
  task: Task,
  answers: OnboardingAnswers,
  ctx: SessionComputeContext = {},
): TimerInputs {
  const now = ctx.now ?? Date.now();
  const date = new Date(now);
  return {
    task: { difficulty: task.difficulty, estimated_minutes: task.estMinutes },
    context: {
      hour_bucket: hourBucket(date),
      day_of_week: date.getDay() as DayOfWeek,
      sessions_today: ctx.sessionsToday ?? 0,
      hours_since_last: ctx.hoursSinceLast ?? 24,
    },
    history: ctx.history ?? { recent_focus_avg: null, recent_distract: null },
    onboarding: toOnboardingSeed(answers, now),
    sessions_completed: 0,
  };
}

/**
 * Compute the session plan for a task. Called at session start (S3.0). Reads the
 * onboarding answers and the task from their stores, builds the inputs, and runs
 * the cold-start formula (W3). Synchronous — stores and the formula are sync, so
 * the START tap stays instant.
 *
 * Throws if onboarding answers are missing or the task id is unknown — both are
 * invariant violations (routing guarantees onboarding; the caller passes a real
 * topTask id), so failing loud beats fabricating a plan.
 */
export function computeSessionPlan(
  taskId: string,
  ctx: SessionComputeContext = {},
): SessionPlan {
  const { answers } = useOnboardingStore.getState();
  if (!answers) {
    throw new Error(
      '[session] computeSessionPlan: onboarding answers missing — onboarding must complete before a session starts.',
    );
  }

  const task = useTaskStore.getState().tasks.find((t) => t.id === taskId);
  if (!task) {
    throw new Error(`[session] computeSessionPlan: no task found for id "${taskId}".`);
  }

  // sessions_today now has a real source (M4.2): count today's completed
  // sessions from SQLite unless the caller supplied it. Resolved here in the
  // impure wrapper so buildSessionInputs stays pure. One indexed COUNT at
  // session start (not a render/tick path) — cheap and synchronous.
  const now = ctx.now ?? Date.now();
  const sessionsToday = ctx.sessionsToday ?? countSessionsToday(now);
  const inputs = buildSessionInputs(task, answers, { ...ctx, now, sessionsToday });

  // M4.7 / L17 — depletion debt as a post-modifier on the regime router output.
  //
  // The mechanism: compute the cold-start output as if there were NO same-day
  // fatigue (`sessions_today = 0` ⇒ `fatigueMod = 1.0`), then apply the floored
  // joint depletion modifier (`max(0.75, fatigueMod × recoveryMod)`) in place
  // of the two separate factors. This is the L17 "in place of" semantics:
  //   final_focus = clamp(15, 90) × round(base × distract × diff × time × DMOD)
  // The frozen `coldStart.ts` constants stay untouched — this path reads them
  // through the lifted exports only.
  const noFatigueInputs: TimerInputs = {
    ...inputs,
    context: { ...inputs.context, sessions_today: 0 },
  };
  const baseline = computeColdStart(noFatigueInputs);

  const { gapMin, prevBreak } = resolveRecoveryGap(ctx);
  const fmod = fatigueMod(sessionsToday);
  const rmod = recoveryMod(gapMin, prevBreak);
  const dmod = depletionMod(fmod, rmod);

  const depletedFocus = Math.floor(baseline.focusMinutes * dmod);

  // L20 / Bug #6 — task-estimate cap. The cold-start formula recommends FOCUS
  // CAPACITY, not task length, so a 25-min task can land a 72-min "Suggested
  // stop" and the user runs out of work mid-overrun. Cap the recommendation at
  // ceil(estMinutes × 1.5) (planning-fallacy buffer) BEFORE the FOCUS_MIN
  // clamp wins for tiny tasks (the science floor still holds — a 5-min task
  // gets a 15-min session, not 8). The cap lives here, NOT in coldStart.ts —
  // the frozen formula stays untouched (decisions.md L20).
  //
  // PR4 (audit Finding #8): `Math.ceil(0 × 1.5) = 0` would collapse the
  // recommendation to the lower clamp for a corrupted / zero-estimate task.
  // Treat `estMinutes <= 0` as "no usable estimate" — Infinity makes
  // `min(focus, Infinity)` a true no-op so the formula governs.
  const taskCap =
    task.estMinutes > 0 ? Math.ceil(task.estMinutes * TASK_ESTIMATE_BUFFER) : Infinity;
  const capped = Math.min(depletedFocus, taskCap);

  const adjustedFocus = clamp(capped, FOCUS_MIN, FOCUS_MAX);
  const adjustedBreak = clamp(
    Math.floor(adjustedFocus * BREAK_RATIO),
    BREAK_MIN,
    BREAK_MAX,
  );

  const plan: SessionPlan = {
    focusMinutes: adjustedFocus,
    breakMinutes: adjustedBreak,
    regime: baseline.regime,
  };

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.log('[session] computeSessionPlan', {
      taskId,
      plan,
      fmod,
      rmod,
      dmod,
      gapMin,
      prevBreak,
      taskCap,
      capBites: taskCap < depletedFocus,
    });
  }

  return plan;
}

/** Planning-fallacy buffer on the task estimate before it caps the
 *  recommendation. 1.5 = 50% slack for noisy LLM estimates. Calibrated
 *  constant — revisit with real-usage data. (decisions.md L20) */
export const TASK_ESTIMATE_BUFFER = 1.5;

/** Resolve `gapMin` + `prevBreak` for the M4.7 depletion path. Caller-provided
 *  values win (tests inject); otherwise we read the most-recent ended_at + its
 *  break_minutes from SQLite. First session of the day (no prior row inside
 *  the recovery window) yields a non-positive `prevBreak`, which `recoveryMod`
 *  treats as "no prior session" (returns 1.0 — no penalty). */
function resolveRecoveryGap(ctx: SessionComputeContext): {
  gapMin: number;
  prevBreak: number;
} {
  if (
    ctx.recoveryGapMin !== undefined &&
    ctx.recommendedBreakMin !== undefined
  ) {
    return { gapMin: ctx.recoveryGapMin, prevBreak: ctx.recommendedBreakMin };
  }
  const lastEndedAt = getLastSessionEndedAt();
  if (lastEndedAt === null) {
    return { gapMin: 0, prevBreak: 0 }; // recoveryMod returns 1.0 on prevBreak <= 0
  }
  const now = ctx.now ?? Date.now();
  const gapMin = Math.max(0, (now - lastEndedAt) / 60_000);
  // Pull the most-recent row's stored break_minutes — already recomputed-at-DONE
  // per M4.6 (`finalize` writes the recomputed value into the stored plan).
  const recent = getRecentSessions(1);
  const prevBreak = recent[0]?.plan.breakMinutes ?? 0;
  return { gapMin, prevBreak };
}
