# shared/spec/onboarding.md

Onboarding has one job: collect just enough data to seed the cold-start formula so day-1 sessions are still personalized.

## Sequence

```
Sign Up → Q1 → Q2 → Q3 → Q4 → Seed Model → Home
```

Sign-up: email or Apple ID via Firebase Auth.

## The four seed questions

### Q1 — Focus duration

> How long can you focus before your mind wanders?

- UI: slider, range 10–90 minutes, default 45, snap to 5-minute increments.
- Stored as `onboarding.base_focus: number` (minutes).
- Feeds the cold-start formula directly.

### Q2 — Distraction tendency

> How easily do you get distracted?

- UI: segmented control, three options.
- Stored as `onboarding.distraction_level: 'easy' | 'neutral' | 'hard'`.
- Maps to `distraction_mod`:
  - `easy` → 0.8 (shorter sessions recommended)
  - `neutral` → 1.0
  - `hard` → 1.15 (longer sessions tolerated)

### Q3 — Time of day preference

> When are you sharpest?

- UI: segmented control, three options.
- Stored as `onboarding.preferred_time: 'morning' | 'afternoon' | 'evening'`.
- Feeds `time_match_mod`: 1.0 if current `hour_bucket` matches preference, else 0.85.

### Q4 — Use case

> What do you mainly use this for?

- UI: segmented control, four options.
- Stored as `onboarding.use_case: 'studying' | 'work' | 'creative' | 'coding'`.
- Feeds the LLM task classifier as a system-prompt hint.

## Storage

Persisted in two places:

1. **MMKV** under key `floq.onboarding` for fast read on app boot.
2. **Firestore** `users/{uid}/onboarding` document for cross-device sync.

MMKV is the source of truth for the cold-start formula (no network round-trip during session start).

## First-session framing card

Shown exactly once, immediately before the user's very first session.

- Gated on `users.has_seen_intro` (Firestore + MMKV mirror).
- 4 steps, swipeable or with a Next button.
- Single `Got it, let's go` button at the end.
- After dismissal, an info icon appears in the session screen header — tapping it re-shows the card (read-only).

### Step 1
> **Floq's timer learns from your brain, not the clock.**
>
> Most apps interrupt you at 25 minutes. Your brain runs on different cycles.

### Step 2
> **The first 20 minutes will feel hard.**
>
> That's the Struggle phase — your brain loading information. Push through; this is the on-ramp, not failure.

### Step 3
> **Then your brain shifts.**
>
> Release, then Flow. You'll watch the phase indicator move. Time will feel different.

### Step 4
> **One tap if you get distracted.**
>
> No shame, just data. The app learns your real rhythm from how you actually work.

## Why the framing card matters

Even with a personalized cold-start formula, session 1 is the moment of truth. If the user finishes onboarding, taps Start, and sees a regular-looking timer, the entire premise of the app is invisible. The framing card teaches the user about the phase indicator they're about to see.
