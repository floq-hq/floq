// Timer service types. Locked signatures — see the floq-timer skill.
// Pure data shapes only; no React, no I/O.

export type Phase = 'struggle' | 'release' | 'flow' | 'recovery';

export type HourBucket = 'morning' | 'afternoon' | 'evening' | 'night';
export type DistractionLevel = 'easy' | 'neutral' | 'hard';
export type PreferredTime = 'morning' | 'afternoon' | 'evening';

export interface OnboardingSeed {
  base_focus: number; // minutes, 10–90
  distraction_level: DistractionLevel;
  preferred_time: PreferredTime;
  use_case: 'studying' | 'work' | 'creative' | 'coding';
  decay_weight: number; // 1.0 → 0.0 over 14 days
}

export interface TimerInputs {
  task: { difficulty: 1 | 2 | 3 | 4 | 5; estimated_minutes: number };
  context: {
    hour_bucket: HourBucket;
    day_of_week: 0 | 1 | 2 | 3 | 4 | 5 | 6;
    sessions_today: number;
    hours_since_last: number;
  };
  history: {
    recent_focus_avg: number | null; // null = no history
    recent_distract: number | null;
  };
  onboarding: OnboardingSeed;
  sessions_completed: number; // lifetime, for regime routing
}

export interface SessionPlan {
  focusMinutes: number;
  breakMinutes: number;
  regime: 'cold' | 'warming' | 'mature';
  /** The encoded 13-dim model input that produced this plan (ml/MODEL_SPEC.md),
   *  captured for the local ML training outbox (L23). Only `computeSessionPlan`
   *  sets it; the regime engines leave it undefined. Title-free / no PII — rides
   *  to the outbox via finalize, and is NOT written to the Firestore session
   *  mirror (which maps explicit fields). */
  features?: readonly number[];
}

// One completed session's behavioral outcome, fed to the warming blend.
// Sourced from session history (SQLite, M4.2). `focusMinutes` is the actual
// focused minutes the user achieved, not the recommended plan.
export interface BehavioralSession {
  focusMinutes: number;
  hourBucket: HourBucket;
  useCase: OnboardingSeed['use_case']; // = task_type, for the matching filter
  endedAt: number; // epoch ms, for recency ordering
}

// Inputs to the focus-score formula (M4.1). Assembled at Done (S3.3) from the
// completed session: actual focused minutes, the distraction count, and the
// worked-on task's difficulty. Object form so the three numbers can't be
// transposed at the call site.
export interface FocusScoreInputs {
  sessionMinutes: number;
  distractionCount: number;
  difficulty: 1 | 2 | 3 | 4 | 5;
}
