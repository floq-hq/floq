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
  fatigueMod,
} from '../timer/coldStart';
import type {
  BehavioralSession,
  HourBucket,
  SessionPlan,
  TimerInputs,
} from '../timer';
import { warmingAlpha } from '../timer';
import { routeSessionPlan } from '../ml/regimeRouter';
import { matureInfer } from '../ml/matureInfer';
import { encodeFeatures } from '../ml/featureVector';
import { toOnboardingSeed } from '../onboarding/seed';
import type { OnboardingAnswers } from '../onboarding/types';
import type { Task } from '../tasks';
import type { CompletedSession } from './types';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import { useTaskStore } from '../../stores/useTaskStore';
import {
  countSessionsAllTime,
  countSessionsToday,
  getLastSessionEndedAt,
  getRecentSessions,
} from '../storage/sessions';
import { weekStartMs } from '../stats/aggregations';
import { depletionMod, recoveryMod } from './recovery';

/** How many recent sessions to pull for the warming behavioral blend (M5.4).
 *  The blend recency-weights matches within this window; 30 covers a typical
 *  rolling fortnight+ of usage. Tunable — not a frozen constant. */
const BEHAVIORAL_LOOKBACK = 30;

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
  sessionsCompleted?: number; // default: countSessionsAllTime() — lifetime count, drives the regime (M5.4)
  hoursSinceLast?: number; // default 24
  history?: { recent_focus_avg: number | null; recent_distract: number | null };
  behavioral?: BehavioralSession[]; // default: built from getRecentSessions() — the warming blend signal (M5.4)
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
    sessions_completed: ctx.sessionsCompleted ?? 0,
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

  // Live SQLite reads, resolved here in the impure wrapper so buildSessionInputs
  // stays pure. All overridable via ctx (tests inject). One indexed COUNT + one
  // bounded SELECT at session start (not a render/tick path) — cheap and sync.
  //  • sessions_today (M4.2)      → cold-start fatigue
  //  • sessions_completed (M5.4)  → which regime the router picks
  //  • recent rows                → reused for BOTH the warming behavioral blend
  //                                  AND the M4.7 prevBreak gap clock (one query)
  const now = ctx.now ?? Date.now();
  const sessionsToday = ctx.sessionsToday ?? countSessionsToday(now);
  const sessionsCompleted = ctx.sessionsCompleted ?? countSessionsAllTime();
  const recent = getRecentSessions(BEHAVIORAL_LOOKBACK);

  // M5.4 — behavioral history for the warming blend. task_type isn't stored per
  // session, but it's the user's single onboarding use_case (not per-task), so
  // every past session shares the current value — stamp it on each row; the
  // warming useCase filter then reduces to an hour-bucket match.
  const useCase = toOnboardingSeed(answers, now).use_case;
  const behavioral = ctx.behavioral ?? recent.map((s) => toBehavioralSession(s, useCase));

  // Warming's secondary fallback (timer.md): rolling 7-day average focus minutes,
  // used when fewer than 2 same-bucket behavioral matches exist. Derived from the
  // already-fetched rows — no extra query. weekStartMs is the DST-safe window.
  const recentFocusAvg =
    ctx.history?.recent_focus_avg ?? meanFocusSince(behavioral, weekStartMs(now));

  const inputs = buildSessionInputs(task, answers, {
    ...ctx,
    now,
    sessionsToday,
    sessionsCompleted,
    history: {
      recent_focus_avg: recentFocusAvg,
      recent_distract: ctx.history?.recent_distract ?? null,
    },
  });

  // M4.7 / L17 — depletion debt as a post-modifier on the regime router output.
  //
  // The mechanism: compute the regime baseline as if there were NO same-day
  // fatigue (`sessions_today = 0` ⇒ `fatigueMod = 1.0`), then apply the floored
  // joint depletion modifier (`max(0.75, fatigueMod × recoveryMod)`) in place
  // of the two separate factors. This is the L17 "in place of" semantics:
  //   final_focus = clamp(15, 90) × round(baseline × DMOD)
  // The frozen `coldStart.ts` constants stay untouched — both the cold path and
  // warming's cold component read them through the lifted exports only.
  const noFatigueInputs: TimerInputs = {
    ...inputs,
    context: { ...inputs.context, sessions_today: 0 },
  };
  // M5.4 — route through the regime engine (cold / warming blend / mature) by
  // lifetime tenure instead of always cold-starting. M5.3 injects the TFLite
  // inferer for the mature regime; until the model is loaded (or if it fails),
  // matureInfer returns null and routeSessionPlan falls back to the warming
  // blend — the documented defensive path.
  const baseline = routeSessionPlan(noFatigueInputs, behavioral, matureInfer);

  const { gapMin, prevBreak } = resolveRecoveryGap(ctx, recent);
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
    // L23: capture the model's input vector for the local training outbox.
    // Encode the REAL context (full `inputs`, real sessions_today) — that's what
    // a v2 model conditions on, not the no-fatigue baseline used for routing.
    features: Array.from(encodeFeatures(inputs)),
  };

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.log('[session] computeSessionPlan', {
      taskId,
      plan,
      regime: baseline.regime,
      sessionsCompleted,
      // M6.2: the warming blend weight (cold ⊗ behavioral). Only meaningful in
      // the warming regime — at α=1 the blend is pure cold, at α=0 pure
      // behavioral; logged so the blend is observable in dev sanity checks.
      alpha: warmingAlpha(sessionsCompleted),
      behavioralCount: behavioral.length,
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

/** Map a stored session row → the warming blend's BehavioralSession (M5.4).
 *  hourBucket is derived from `startedAt` (not stored as a column); useCase is
 *  stamped by the caller (the user's single onboarding use_case). */
function toBehavioralSession(
  s: CompletedSession,
  useCase: BehavioralSession['useCase'],
): BehavioralSession {
  return {
    focusMinutes: s.actualFocusMinutes,
    hourBucket: hourBucket(new Date(s.startedAt)),
    useCase,
    endedAt: s.endedAt,
  };
}

/** Rolling mean of focus minutes for sessions ended at/after `sinceMs`. `null`
 *  when the window is empty — the warming blend treats that as "no behavioral
 *  fallback" and leans on the cold result. */
function meanFocusSince(sessions: readonly BehavioralSession[], sinceMs: number): number | null {
  let sum = 0;
  let count = 0;
  for (const s of sessions) {
    if (s.endedAt < sinceMs) continue;
    sum += s.focusMinutes;
    count += 1;
  }
  return count === 0 ? null : sum / count;
}

/** Resolve `gapMin` + `prevBreak` for the M4.7 depletion path. Caller-provided
 *  values win (tests inject); otherwise we read the most-recent ended_at + its
 *  break_minutes from SQLite. `recent` is the already-fetched recent-sessions
 *  window (newest first) — reused here so there's a single query per START.
 *  First session of the day (no prior row inside the recovery window) yields a
 *  non-positive `prevBreak`, which `recoveryMod` treats as "no prior session"
 *  (returns 1.0 — no penalty). */
function resolveRecoveryGap(
  ctx: SessionComputeContext,
  recent: readonly CompletedSession[],
): {
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
  // Most-recent row's stored break_minutes — already recomputed-at-DONE per M4.6
  // (`finalize` writes the recomputed value into the stored plan). `recent[0]` is
  // newest (getRecentSessions orders by ended_at DESC).
  const prevBreak = recent[0]?.plan.breakMinutes ?? 0;
  return { gapMin, prevBreak };
}
