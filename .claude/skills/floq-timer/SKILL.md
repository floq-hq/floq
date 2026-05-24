---
name: floq-timer
description: Use this skill whenever the user asks Claude to write, modify, test, debug, or review anything related to Floq's timer, focus session logic, cold-start formula, warming blend, mature TFLite inference, regime router, focus score, phase indicator (Struggle/Release/Flow/Recovery), distraction logging, or session-end summary. Triggers include the words "timer", "cold start", "cold-start formula", "warming blend", "regime", "phase", "Struggle", "Release", "Flow", "Recovery", "focus score", "distraction penalty", "session start", "ultradian", or any change to files under mobile/services/timer/ or mobile/services/ml/. Do NOT use for UI work on the session screen layout — that's a frontend task, not a timer task.
---

# Floq timer — implementation skill

This skill loads the constraints around Floq's most safety-critical surface: the timer and focus-session logic. Every constant here is research-backed (see `shared/spec/science.md`) and frozen.

## Before you write any timer code

1. Read `shared/spec/timer.md` in full. Do not re-derive the formulas from memory.
2. Read `shared/spec/science.md` for the constants and their citations.
3. Check `shared/spec/decisions.md` for any open decision that affects what you're about to do.

If any constant or formula you're about to write doesn't match `timer.md`, stop and surface it.

## Hard rules

- **Pure functions only** in `mobile/services/timer/`. No React imports. No I/O. The whole module must be unit-testable in plain Node.
- **Never change** the values `23`, `0.22`, `0.85`, `0.8`, `1.15`, `0.9`, `15`, `90`, `5`, `25` without explicit user confirmation. These are the research-backed constants.
- **No 25-minute hard cap.** Anywhere. Adding one means you've misunderstood the product.
- **Clamp at the end**, not in the middle. The formula multiplies first, then clamps to research-backed bounds.
- **No pause behavior.** Pausing IS a distraction — there must be no `pauseSession()` function. If the user requests one, surface the conflict.

## File layout in `mobile/services/timer/`

```
timer/
  index.ts              public API (re-exports)
  types.ts              SessionPlan, Phase, TimerInputs, etc.
  coldStart.ts          cold-start formula (sessions 0–4)
  warming.ts            warming blend (sessions 5–13)
  phases.ts             pure phase state machine
  focusScore.ts         focus-score formula
  __tests__/
    coldStart.test.ts
    warming.test.ts
    phases.test.ts
    focusScore.test.ts
```

Adding files outside this layout requires a reason.

## Required test cases

Every timer module has the following non-negotiable tests:

### `coldStart.test.ts`
- Brand-new user, all neutral inputs, morning → 45 min (or whatever Q1 default is) with break = 0.22 * focus, both clamped.
- Hard task at preferred time, 1st session today: `60 × 1.0 × 0.85 × 1.0 × 1.0 = 51`. Worked example from spec.
- Easy task at off-peak time, 4th session: applies 0.85 time-mismatch and 0.8 fatigue.
- Maxed-out inputs (`base_focus=90`, neutral, hard task, off-peak, 4th session): must clamp to 15-min lower bound after multipliers.
- Minimum inputs (`base_focus=10`, easy distraction-prone user): clamp to 15-min lower bound.

### `phases.test.ts`
- `elapsedSeconds = 0` → 'struggle'
- `elapsedSeconds = 19 * 60` → 'struggle'
- `elapsedSeconds = 21 * 60` → 'flow' (Release is a transition, not a sustained state)
- `elapsedSeconds = plan.focusMinutes * 60 + 1` → 'recovery'
- Phase is pure: same inputs → same output, always.

### `focusScore.test.ts`
- 60 minutes, 0 distractions, difficulty 3 → score = 60.
- 60 minutes, 1 distraction, difficulty 3 → score = 37 (60 - 23).
- 60 minutes, 1 distraction, difficulty 5 → score = (60 - 23) * (5/3) ≈ 61.67.
- 30 minutes, 2 distractions, difficulty 3 → score = -16 (yes, negative is correct and meaningful).
- Score must NOT be clamped to zero — negative scores are valuable feedback.

### `warming.test.ts`
- `sessions_done = 5` → `alpha = 0.9` (heavy cold-formula weight).
- `sessions_done = 14` → `alpha = 0` (pure behavioral).
- Fewer than 2 matching behavioral samples → fall back to 7-day all-sessions average.
- All-empty behavioral history → return cold formula result alone, do not return NaN.

## TypeScript signatures (locked)

```ts
// types.ts
export type Phase = 'struggle' | 'release' | 'flow' | 'recovery';

export type HourBucket = 'morning' | 'afternoon' | 'evening' | 'night';
export type DistractionLevel = 'easy' | 'neutral' | 'hard';
export type PreferredTime = 'morning' | 'afternoon' | 'evening';

export interface OnboardingSeed {
  base_focus: number;           // minutes, 10–90
  distraction_level: DistractionLevel;
  preferred_time: PreferredTime;
  use_case: 'studying' | 'work' | 'creative' | 'coding';
  decay_weight: number;         // 1.0 → 0.0 over 14 days
}

export interface TimerInputs {
  task: { difficulty: 1 | 2 | 3 | 4 | 5; estimated_minutes: number };
  context: {
    hour_bucket: HourBucket;
    day_of_week: 0|1|2|3|4|5|6;
    sessions_today: number;
    hours_since_last: number;
  };
  history: {
    recent_focus_avg: number | null;   // null = no history
    recent_distract: number | null;
  };
  onboarding: OnboardingSeed;
  sessions_completed: number;          // lifetime, for regime routing
}

export interface SessionPlan {
  focusMinutes: number;
  breakMinutes: number;
  regime: 'cold' | 'warming' | 'mature';
}
```

If a signature change is needed, surface it before changing — multiple modules depend on these shapes.

## Common mistakes to avoid

- Computing `break` before clamping `focus`. Always: compute focus → clamp focus → `break = focus * 0.22` → clamp break.
- Using `Math.round` instead of `Math.floor` for minutes. We round down — overshooting the upper clamp is worse than undershooting.
- Importing from `mobile/app/` or `mobile/components/` into the timer service. The timer is a leaf; nothing in the UI tree should be importable from here.
- Caching the recommendation across sessions. The whole point is that it's recomputed every time.
