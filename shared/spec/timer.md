# shared/spec/timer.md

The timer is the brain of Floq. Every constant here is research-backed (see `science.md`). **Do not change these values without explicit approval — see Safety Rules in root `CLAUDE.md`.**

## The four phases

| Phase | Window | UI behavior |
|---|---|---|
| Struggle | 0 – 20 min | Friction is normal. Do not interrupt. Encourage push-through. |
| Release | ~20 min | Brain lets go. Brief transition. |
| Flow | 20 – 90 min | Protect this. Distractions reset the recovery clock. |
| Recovery | 15 – 20 min after Done | Recommended, **skippable** (L17). Replenishes attention. Starting before the end→start gap closes trims the next session's recommendation (`recovery_mod`). |

Implementation: pure state machine in `mobile/services/timer/phases.ts`. Signature:

```ts
type Phase = 'struggle' | 'release' | 'flow' | 'recovery';
function phaseFor(elapsedSeconds: number, plan: SessionPlan): Phase;
```

No timers, no React, no side effects. Just math.

## Per-session computation

Recommendation is recomputed at **session start**, not once per day. Same user at 9am vs 9pm is a different user — fatigue and context are live signals.

### Inputs

| Input | Source | Type |
|---|---|---|
| `task.difficulty` | LLM classifier (1–5) | int |
| `task.estimated_minutes` | LLM estimate | int |
| `context.hour_bucket` | current local time → morning / afternoon / evening / night | enum |
| `context.day_of_week` | weekday vs weekend | enum |
| `context.sessions_today` | counter, resets at local midnight | int |
| `context.hours_since_last` | proxy for recovery → drives `recovery_mod` (L17) | float |
| `history.recent_focus_avg` | rolling 7-day average focus minutes | float |
| `history.recent_distract` | rolling 7-day average distractions per session | float |
| `onboarding.seed * decay` | onboarding weight, linear decay over 14 days | float |

## Cold-start formula (sessions 0–4)

Pure formula. Conservative on purpose — short sessions build the habit.

```ts
focus = onboarding.base_focus            // Q1 slider, 10–90
      * distraction_mod                  // Q2: easy 0.8 / neutral 1.0 / hard 1.15
      * difficulty_mod                   // task: easy 1.0 / med 1.0 / hard 0.85
      * time_match_mod                   // 1.0 if matches Q3 pref, else 0.85
      * fatigue_mod;                     // 1st today 1.0 / 2nd 0.9 / 3rd+ 0.8

break = focus * 0.22;                    // 90/20 ratio

focus = clamp(focus, 15, 90);
break = clamp(break, 5, 25);
```

**Worked example** (must round-trip through unit tests):

- Brand new user, Q1=60, Q2=neutral, Q3=morning preference
- Tuesday 10am, 1st session today, hard task
- `60 × 1.0 × 0.85 × 1.0 × 1.0 = 51.0`
- Recommendation: focus = 51, break = 11

## Warming formula (sessions 5–13)

Blend the cold formula with the user's behavioral averages. Blend weight shifts linearly toward behavior:

```ts
alpha = max(0, 1 - (sessions_done - 4) / 10);   // 1.0 → 0.0 across 10 sessions

behavioral_focus = weighted_avg(
  last sessions where task_type matches AND hour_bucket matches
);

focus = alpha * cold_formula_result + (1 - alpha) * behavioral_focus;
break = focus * 0.22;
```

**Edge case to handle:** if fewer than 2 matching sessions exist for `behavioral_focus`, fall back to the rolling 7-day average across all sessions. If that's also empty, use the cold formula result alone.

## Mature inference (sessions 14+)

TFLite model takes over. See `shared/spec/ml-regimes.md`. Onboarding is fully diluted. Model is trained against the user's own outcomes.

## Focus depth score

Master metric. Same formula in all regimes.

```ts
focus_score = (session_minutes - distraction_count * 23) * difficulty_mult;
difficulty_mult = task_difficulty / 3.0;   // difficulty ∈ {1..5}
```

The `23` is the research-backed minutes-of-recovery cost per distraction (Mark et al., UC Irvine). It is not tunable.

## Behavioral rules (must be enforced in UI)

1. **Only one task is visible at a time.** Hidden tasks reappear after the current is done.
2. **Distraction button always visible** during a session. One-tap log, no confirm.
3. **No pause.** Pausing IS a distraction — log one and continue.
4. **Recovery is recommended, not blocked (L17 supersedes the old hard-enforce).** After Done the app recommends a break (5–25 min); the next session is **not** blocked. Under-resting (starting before the end→start gap closes) trims the next recommendation via `recovery_mod` — see `decisions.md` L17.
5. **Timer recomputes at every session start.**

## Why not Pomodoro

A Pomodoro 25/5 interrupts the user right when their brain is entering Release. The whole point of Floq is to never interrupt during Struggle and to protect Flow above all else. This is the design's central claim; if you find yourself adding a 25-minute hard cap, stop.
