// Session compute orchestrator (M3.3).
//
// Turns "user tapped START on task X" into a concrete SessionPlan. This is the
// orchestration layer ABOVE the frozen timer service: it gathers live inputs
// (onboarding answers, the chosen task, current context), assembles a
// TimerInputs, and runs the regime router — then hands back the plan. It READS
// the timer service; it never modifies it.
//
// W3 is cold-regime only — no behavioral history exists yet (SQLite lands in
// M4.2) — so it calls computeColdStart directly. The M5.2 regime router and M5.4
// warming wiring slot in behind this same signature later; callers (S3.0) don't
// change. The pure core (hourBucket / buildSessionInputs) has no React and no
// I/O; only the thin computeSessionPlan wrapper reads stores via getState().

import { computeColdStart } from '../timer';
import type { HourBucket, SessionPlan, TimerInputs } from '../timer';
import { toOnboardingSeed } from '../onboarding/seed';
import type { OnboardingAnswers } from '../onboarding/types';
import type { Task } from '../tasks';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import { useTaskStore } from '../../stores/useTaskStore';
import { countSessionsToday } from '../storage';

type DayOfWeek = TimerInputs['context']['day_of_week']; // 0..6 (Sun..Sat)

// Live inputs to computeSessionPlan. `sessionsToday` now has a real source
// (M4.2: counted from SQLite when omitted — see computeSessionPlan); the rest
// are still defaulted until their sources land. `now` is injectable so the
// hour-bucket/decay derivation and the today-count are deterministic under test.
export interface SessionComputeContext {
  now?: number; // default Date.now()
  sessionsToday?: number; // default: countSessionsToday(now) from SQLite (M4.2)
  hoursSinceLast?: number; // default 24
  history?: { recent_focus_avg: number | null; recent_distract: number | null };
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

  // W3: cold regime only. M5.2 regime router / M5.4 warming wiring replace this
  // line later, behind the same signature.
  const plan = computeColdStart(inputs);

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    // eslint-disable-next-line no-console
    console.log('[session] computeSessionPlan', { taskId, plan });
  }

  return plan;
}
