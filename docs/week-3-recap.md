# Floq — Week 3 recap

**Week goal:** a user can start a session, watch the phase indicator move Struggle → Flow, tap "got distracted" to log a distraction, and tap Done to end — with distractions persisted and the timer computed via the cold-start formula.

**Status: ✅ complete.** All W3 issues closed (#20–#28, #102), 15 PRs merged to `main`. The full session loop is live end-to-end: start → animated timer + phase machine → distraction logging (button **and** background) → Done → session-end summary. O4 resolved (**L15**).

---

## What shipped

### Mohamed — ML / timer / backend

| Task | What | PR / issue |
|---|---|---|
| **M3.1** | **Phase state machine** — pure `services/timer/phases.ts`: `(elapsedSeconds, plan) → phase`. Struggle 0–~20 → Flow → Recovery past `focusMinutes`. Deterministic, no timers. | #86 / #20 |
| **M3.2** | **Distraction logging service** — `logDistraction()` funnel + `useActiveSessionStore`. Distractions batched as a `number[]` of timestamps, MMKV-mirrored (survive an app kill), flushed to Firestore in **one transaction** on Done. | #90, #97 / #21 |
| **M3.3** | **Session compute orchestrator** — `computeSessionPlan(taskId)` pulls live inputs and returns a `SessionPlan` (cold-start only this week; regime router lands W5). `hourBucket()` wall-clock time-of-day. | #88 / #22 |
| **M3.4** | **Background-during-session policy** — `services/session/backgroundPolicy.ts` + `useSettingsStore`. Watches `AppState`; `forgiving` (>30s, default) / `strict` (any) → logs a distraction via the M3.2 funnel. Pure `exceedsThreshold` unit-tested. Resolved **O4 → L15**. | #93 / #23 |

### Mustafa — frontend / UI

| Task | What | PR / issue |
|---|---|---|
| **S3.0** | **Start-session flow** — `START` computes the plan for the top task, gates the framing card, opens `/focus`. | #89 / #24 |
| **S3.1** | **Session screen UI** — `app/focus.tsx`: phase pill, big tabular timer driven by Reanimated (off the JS thread), task name, no pause button. | #91 / #25 |
| **S3.2** | **GOT DISTRACTED button** — always-visible, one tap, medium haptic + single danger flash, optimistic count. | #92 / #26 |
| **S3.3** | **DONE + session-end summary** — writes the session, `markDone` auto-promotes the next task, summary (minutes / distractions / score placeholder / recovery), auto-dismiss. | #94, #95 / #27 |
| **S3.4** | **Background-during-session UX** — wires `startBackgroundPolicy({ onBackgroundDistraction })` on the focus screen; subtle on-return toast ("Backgrounded for 47s — logged a distraction."). | #98, #101 / #28 |
| **S3.5** | **Background-policy setting UI** — Settings screen with a Forgiving/Strict picker bound to `useSettingsStore`, one calm line each; gear entry on Home; settings hydrated at launch. | #100 / #102 |

### Shared / cross-cutting

- **Session became a full-screen takeover, not a tab** (#95). The Session tab is a **launchpad** (top task + START); starting opens `/focus`, which renders **over** the tabs — so the bottom bar, pause, and back-gesture all disappear for the duration. DONE is the only exit ("no pause" enforced structurally).
- **Settings layer introduced** (`services/settings/` + `useSettingsStore`, MMKV `floq.settings`) for M3.4/S3.5, hydrated once at app launch.

---

## Decisions

### Locked this week
- **L15 — Background-during-session policy = a user setting** (resolves O4). `forgiving` (>30s, default) vs `strict` (any background); one distraction per background→foreground episode via the M3.2 funnel. Only `AppState 'background'` starts the clock — `'inactive'` (app-switcher peek, notification shade) is ignored. **Option (c) "exempt calls/alarms" deferred** — `AppState` doesn't expose *why* the app backgrounded; detecting it needs native CallKit, which conflicts with managed Expo. Split **M3.4 (service + setting, Mohamed) → S3.4 (toast) / S3.5 (picker), Mustafa**.

### Opened for later
- **O10 — Circadian-relative time matching** (Mohamed): match *hours-since-waking* instead of wall-clock for `time_match_mod`. Not blocking — MVP keeps wall-clock bucketing in M3.3; isolated to `hourBucket()` so (b) can replace it later without touching the frozen formula. Needs a wake-time signal (new onboarding Q or history inference).

### Still open (by design, later weeks)
- **O7** skippable break / enforced-recovery override — *was due end of W3; still open* (recovery enforcement UI not yet built; recommended option (b) skippable-with-friction). · **O5** friend-graph schema (W6) · **O6** streak across time-zones (W4) · **O8/O9** post-MVP.

---

## Notable findings & gotchas (so we don't relearn them)

- **Reanimated v4 on SDK 55 needs the worklets package.** A bare `expo install react-native-reanimated` crashes the bundler — you must also install `react-native-worklets` and **rebuild the dev client**. Required for the off-JS-thread timer tick.
- **The session clock must be wall-clock based, not frame-based** (#101). The timer was driven by Reanimated's `timeSinceFirstFrame`, which **restarts to 0 on a remount/re-render** (e.g. when the on-return toast auto-dismisses) — resetting the displayed time, and with a non-idempotent `startSession`, **wiping logged distractions**. Fixed by deriving the clock from `now - session.startedAt` each frame and making session start **resume-aware**. This is what "the session cannot be paused" (timer.md / session-flow.md) actually requires.
- **`AppState` can't tell you *why* the app backgrounded** (L15) — only active / background / inactive, never "phone call." Call/alarm exemption therefore needs native CallKit (a custom module + rebuild) and is deferred. Quick app-switcher peeks fire `'inactive'`, which we ignore, so they don't false-trigger a distraction.
- **Distractions are batched, never written per tap** (M3.2) — appended to the active session as timestamps, mirrored to MMKV (so they survive an app kill mid-session), and written to Firestore in a single transaction on Done.

---

## Process / conventions in force

- `main` is the integration branch; **feature branch → PR → merge**, one PR = one concern. **Done = `typecheck` + `test` pass.**
- **Gotcha this week (process):** S3.4's PR (#98) merged the *original* commit; a later `--amend` + force-push (to fold in the timer fix) landed *after* the branch was already heading to merge, so the fix missed `main` and had to ship separately as **#101**. Lesson: **once a branch is up for merge, don't amend + force-push — add a follow-up commit.**

---

## What's next — Week 4 (preview)

- **Mohamed:** M4.1 focus-score formula (merged early, #96) · M4.2 SQLite session **+ task** persistence (open, #99 — also where task account-isolation lands, per W2) · M4.3 stats data layer · M4.4 streak computation (resolves O6).
- **Mustafa:** S4.1 stats screen UI (historical only, regime-gated badge) · S4.2 local notifications · S4.3 empty / error states across the app.
