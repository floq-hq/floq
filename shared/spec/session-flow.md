# shared/spec/session-flow.md

End-to-end user journey for a single Floq session. The timer is computed AT session start with live signals.

## Flow diagram

```
Brain Dump (type or speak)
    ↓
LLM Parse (free tier API) → subtasks
    ↓
Priority Queue (user reorders)
    ↓
Top Task visible, others hidden
    ↓
[start tapped]
    ↓
Compute Session Timer (regime router runs NOW with live inputs)
    ↓
FOCUS SESSION (phase indicator + live timer)
    ↓ (during session)
  ┌── Distraction? ──→ Log Distraction (+1, timestamp). Session continues.
  │
  └── Done tapped ──→ Compute focus score
                          ↓
                      Recovery break (5–25 min, enforced)
                          ↓
                      Update ML / Sync to social profile
                          ↓
                      Next session unlocks
```

## Behavioral rules (enforced)

1. **Only one task visible at a time.** Reduces cognitive load, forces commitment. Hidden tasks reappear only after the current is marked done.
2. **The distraction button is always visible** during a session. One tap. No friction, no confirm dialog. Each tap costs the 23-min penalty in the score, but the UX stays forgiving.
3. **The session cannot be paused.** Pausing IS a distraction. If the user tries to pause, log a distraction and continue.
4. **Recovery is enforced.** After Done, the app suggests a 15–20 minute break before the next session unlocks. The Start button is disabled during recovery.
5. **Timer recomputes at every session start.** Same user, different state (fatigue, time of day, current task). The regime router takes live inputs and outputs a fresh recommendation.

## Background behavior (pending decision — see `decisions.md`)

Proposed default: app backgrounded for > 30 seconds during an active session = log one distraction.

Edge cases to handle:
- iOS forces background (phone call, alarm) → still counts as a distraction by default. Surface this in the post-session summary so the user can mentally adjust.
- App is killed → on next launch, if a session was active, ask the user whether to discard or save with the time elapsed up to backgrounding.
- Screen lock → no distraction logged automatically; only background time counts.

## Streak definition

`streak_days = number of consecutive local-calendar days with ≥ 1 completed session`.

- "Completed" = user tapped Done. Distraction count does not matter.
- Local calendar = device's current time zone at session-end time.
- Crossing midnight mid-session: counts toward the calendar day in which the session **started**.
- Travel across time zones: streak follows device local time. (May feel odd; revisit post-MVP.)

## Task promotion

After the user taps Done:

1. Current task is removed from the priority queue.
2. The next task in the queue auto-promotes to "top task" — visible on Home.
3. If the queue is empty, Home shows the brain-dump prompt.

The auto-promotion is intentional friction reduction. The "force commitment" rationale is preserved because the user can't see the other tasks during the previous session — they only see the next one after Done.

## Session-end summary

After Done, show a quick summary card before kicking the user to recovery:

- Minutes focused
- Distractions logged
- Focus score (with the formula visible on tap)
- Streak update
- "Recovery: X min" countdown to next session

Then auto-dismiss after 8 seconds (or on tap) to a recovery screen.
