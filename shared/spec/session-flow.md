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
  ┌── Distraction? ─────→ Log Distraction (+1, timestamp). Session continues.
  │
  ├── Past suggested time → Overrun state + cue; keep going. Extra → overrun_minutes (L16).
  │
  ├── Done tapped ──────→ Focus score; record overrun; recompute break from actual mins
  │                           ↓
  │                       Recovery break (5–25 min) — RECOMMENDED + skippable (L17)
  │                           ↓
  │                       Update ML / Sync to social profile
  │                           ↓
  │                       Next session (not blocked; under-rest trims its recommendation)
  │
  └── End early / "I stopped" → prompt Save / Discard (L16)
                                  Save: partial (completed:false) — counts for score + streak; task stays
                                  Discard: nothing written; task stays
```

## Behavioral rules (enforced)

1. **Only one task visible at a time.** Reduces cognitive load, forces commitment. Hidden tasks reappear only after the current is marked done.
2. **The distraction button is always visible** during a session. One tap. No friction, no confirm dialog. Each tap costs the 23-min penalty in the score, but the UX stays forgiving.
3. **The session cannot be paused.** Pausing IS a distraction. If the user tries to pause, log a distraction and continue.
4. **Recovery is recommended, skippable (L17).** After Done the app recommends a break; the next session is **not** blocked and Start is **not** disabled. Starting before the end→start gap closes trims the next session's recommendation via `recovery_mod`. See `decisions.md` L17.
5. **Timer recomputes at every session start.** Same user, different state (fatigue, time of day, current task). The regime router takes live inputs and outputs a fresh recommendation.

## Background behavior (pending decision — see `decisions.md`)

Proposed default: app backgrounded for > 30 seconds during an active session = log one distraction.

Edge cases to handle:
- iOS forces background (phone call, alarm) → still counts as a distraction by default. Surface this in the post-session summary so the user can mentally adjust.
- App is killed → on next launch, if a session was active, prompt **Resume / Save / Discard** (implemented per L16; the in-flight session lives in the MMKV mirror and is written to SQLite only on Save).
- Screen lock → no distraction logged automatically; only background time counts.

## Streak definition

`streak_days = number of consecutive local-calendar days with ≥ 1 **saved** session`.

- A **saved** session = user tapped DONE *or* saved an end-early partial (`completed:false`); only **discarded** sessions don't count toward the streak (L16, supersedes the old "tapped Done only" rule). Distraction count does not matter.
- Local calendar = device's current time zone at session-end time.
- Crossing midnight mid-session: counts toward the calendar day in which the session **started**.
- Travel across time zones: streak follows device local time. (May feel odd; revisit post-MVP.)

## Task promotion

After the user taps Done:

1. Current task is removed from the priority queue.
2. The next task in the queue auto-promotes to "top task" — visible on Home.
3. If the queue is empty, Home shows the brain-dump prompt.

The auto-promotion is intentional friction reduction. The "force commitment" rationale is preserved because the user can't see the other tasks during the previous session — they only see the next one after Done.

**End early ("I stopped") does NOT promote** (L16): the task stays at the top of the queue (no `markDone`), so the user can pick it back up next session.

## Session-end summary

After Done, show a quick summary card before kicking the user to recovery:

- Minutes focused
- Distractions logged
- Focus score (with the formula visible on tap)
- Streak update
- "Recovery: X min" countdown to next session

Then auto-dismiss after 8 seconds (or on tap) to a recovery screen.

## Focus partnership (per `decisions.md` L18 — conviction bet, Phase A)

The product is organized around a **focus partnership**. This section is a **v1 design subject to the L18 validation gate** (if paired users don't out-retain solos at the W8 beta, this reverts and the friends/leaderboard plan is restored).

- **One partner at a time.** You invite **one** specific person (Phase A: a friend). Not a friend list, not a leaderboard. The constraint is the product.
- **Solo is a fully-functional on-ramp.** A user with no partner — or with an invite still pending — has a complete solo experience. **Pairing is never mandatory** (mandatory pairing is the activation cliff). The make-or-break is **time-to-first-partner**, not the streak.
- **Async commitment surface (not live co-working).** Your partner sees your **scheduled** sessions (a soft expectation) and your **completed** ones (minutes / score / when). They never see task titles (L4 invariant). This preserves the async thesis — showing up is visible, missing is visible, but there's no real-time obligation.
- **Pair streak — gentle.** The partnership has a streak, designed with **grace periods** (travel / sick) and so that a **partner's flake does not nuke your individual streak** (L16/L17 spirit). How strong the coupling should be is the **live variable** measured at the W8 beta (L17), not a locked choice.
- **Phase B (stranger-matching) is out of MVP scope** — conditional on the L18 gate; it would require amending L2/L4 and likely capital.

