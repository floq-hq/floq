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
  │                       Session summary (8s glance, stats only — no decisions)
  │                           ↓
  │                       Recovery screen — live countdown; Mark task done? (L19);
  │                                          Start next / Skip (L17)
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

## Task promotion (L19 — DONE doesn't auto-promote)

After the user taps Done:

1. The session record is written (focus score, overrun, recomputed break — L16).
2. **The task STAYS in the priority queue.** A finished session does NOT mean a finished task — most substantial tasks span multiple sessions, and the old "DONE auto-promotes" rule silently consumed long-running tasks (decisions.md L19).
3. The user marks tasks complete **explicitly** — via the *Mark task done* affordance on the post-session summary (best moment for the decision: post-flow, when the user has perspective), or via swipe / queue management on Home.
4. If the user marks done and the queue becomes empty, Home shows the brain-dump prompt.

**End early ("I stopped") does NOT promote either** (L16, unchanged): the task stays at the top of the queue (no `markDone`), so the user can pick it back up next session.

## Session-end summary

A calm stats glance shown for **8 seconds** after Done, then auto-routes to the recovery screen. **No interactive decisions live here** — early sim testing (2026-05-29) found the auto-dismiss left no time for any tap, so the task-done decision moved to the recovery screen where there are minutes of dwell.

- Minutes focused (hero)
- Distractions logged
- Focus score (M4.1; negative scores are meaningful — see `timer.md`)
- Streak (from the live SQLite-derived `useCurrentStreak`, not a separate store)

Tap-anywhere routes to recovery; otherwise the 8-second auto-route fires.

## Recovery screen

A dedicated full-screen route reached automatically from the summary, **unless the session was too short to need recovery** — see "When recovery is skipped" below.

Clean by design — one number, the task-done decision when applicable, two CTAs:

- **Live countdown** (`MM:SS`) from the recomputed `break_minutes` (M4.6). Reanimated tick off the JS thread (same pattern as `SessionTimer`); React state only flips at the boundary, not per second.
- **Mark task done** affordance (Option 7 / L19) — only shown when the just-finished task is still in the queue. Single tap removes the task; auto-promotes the next one. The recovery screen is where this decision belongs because (a) the user is cooling down and has perspective, and (b) the dwell time of the countdown (5–25 min recommended) is generous, unlike the 8-second summary glance.
- **Start next session** — secondary CTA before the countdown completes, primary after (a calm emphasis flip, no animation). Cancels the pending end-of-break notification and routes to `/focus`. When the queue is empty, this CTA is replaced by a calm caption explaining the queue is empty.
- **Skip recovery** — ghost CTA. Cancels the notification, routes to Home. Under-resting trims the next session's recommendation via `recovery_mod` (L17) — never blocked, never docked.

Tap-anywhere does NOT dismiss the recovery screen — this is deliberate dwell. When the countdown reaches `00:00`, the Start CTA's emphasis flips but the screen does not auto-dismiss; the notification fires.

### When recovery is skipped (L21)

If `actualFocusMinutes < 5` (the `MIN_FOCUS_FOR_RECOVERY` threshold), the recovery screen is skipped entirely — the summary's auto-route lands on Home instead. The 5-min break floor was calibrated for real focus (≥15 min); below ~5 min the user expended too little cognitive resource to need a structured break. See `decisions.md` L21.

## Focus partnership (per `decisions.md` L18 — Phase A)

The product is organized around a **focus partnership**. The W8 beta is the market read on whether this loop wins; the design points below are the locked Phase A plan (see L18 for the one-step revert if the read fails).

- **One partner at a time.** You invite **one** specific person (Phase A: a friend). Not a friend list, not a leaderboard. The constraint is the product.
- **Solo is a fully-functional on-ramp.** A user with no partner — or with an invite still pending — has a complete solo experience. **Pairing is never mandatory** (mandatory pairing is the activation cliff). The make-or-break is **time-to-first-partner**, not the streak.
- **Async commitment surface (not live co-working).** Your partner sees your **scheduled** sessions (a soft expectation) and your **completed** ones (minutes / score / when). They never see task titles (L4 invariant). This preserves the async thesis — showing up is visible, missing is visible, but there's no real-time obligation.
- **Pair streak — gentle.** The partnership has a streak, designed with **grace periods** (travel / sick) and so that a **partner's flake does not nuke your individual streak** (L16/L17 spirit). Coupling strength stays the **live variable** during the W8 beta — start gentle, tighten only with evidence.
- **Explicit, revocable consent.** Partner visibility (your schedule + scores) is opt-in at pairing and revoked the moment the partnership ends.
- **Phase B (stranger-matching) is out of MVP scope** — conditional on the W8 market read; it would require amending L2/L4 and likely capital.

