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
}
