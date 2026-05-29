# Floq — Week 4 recap

**Week goal:** completed sessions have a focus score, sessions persist to SQLite, the Stats screen shows historical sessions (regime-gated forecast), and the full **session lifecycle** lands — end-early / kill-restore / overrun / skippable recovery — with a dedicated recovery screen.

**Status: ✅ complete.** 11 PRs merged to `main`. Mohamed's W4 grew well past the original M4.1–M4.4 scope: **L16 + L17** locked the session-lifecycle work (M4.5–M4.9) and a sim-testing audit pass added **L19 / L20 / L21** plus ~15 bug fixes. The result is a focus loop a real user can run end-to-end without dead-ends: DONE → 8s stats glance → recovery countdown (or straight Home for trivial sessions) → next session, with end-early and kill-restore both clean. The Egypt-readiness checklist closes — all M-tasks on the list except W5's M5.2 are shipped.

---

## What shipped

### Mohamed — ML / timer / backend

| Task | What | PR |
|---|---|---|
| **M4.1** | **Focus depth score** — pure `services/timer/focusScore.ts` (`(min − distractions × 23) × difficulty/3`). Negatives allowed by design (frozen formula, Mark et al. UC Irvine). | #96 |
| **M4.2** | **SQLite session + task persistence** — `models/db.ts` migration runner; tables `sessions`, `tasks`, `distractions`; task store source-of-truth swap MMKV → SQLite; per-user account isolation per W2's deferral. | #99 |
| **M4.3** | **Stats data layer** — `services/stats/aggregations.ts` + TanStack hooks (`useWeeklyFocusScore`, `useDistractionRate`, `usePersonalBest`). All sync, SQLite-fed, invalidated under `['stats']`. | #108 |
| **M4.4** | **Streak computation** — `currentStreak(endedAtTimestamps, now)`, device-local-midnight buckets, grace-until-midnight anchor. Counts saved partials (L16). | #108 |
| **M4.5** | **End-early (abandon) + kill/restore lifecycle** — migration 002 (`sessions.completed`), `abandonSession()` + `getRestorableSession()` on `useActiveSessionStore`, `services/session/restore.ts` (`resolveRestore('resume'\|'save'\|'discard')`), `finalize.ts` as the single session-end assembly point. | #120 |
| **M4.6** | **Overrun + recovery-break recompute** — migration 003 (`overrun_minutes`), pure `overrun.ts` (imports the frozen `coldStart` ratio/clamps; drift-guard test asserts `recoveryBreakMinutes(planned) === coldStart`'s break). Stored `break_minutes` reflects the recomputed value. | #120 |
| **M4.7** | **Skippable recovery + `recovery_mod`** — pure `recovery.ts` (`RECOVERY_FLOOR = 0.85`, `DEPLETION_FLOOR = 0.75`); `computeSessionPlan` applies the floored `depletion_mod` after the cold-start output, re-clamps. Resolves **O7 → L17**. | #120 |
| **M4.8** | **End-early + restore prompts (UI)** — `EndEarlySheet` (Save/Discard, then "Saved · N min focused" confirmation), `RestoreSessionPrompt` (Resume/Save/Discard on launch). Mohamed-owned UI per L16's deviation note. | #121 |
| **M4.9** | **Suggested-stop + recovery screen** — `SuggestedStopMeter` (live "N min left" / "Overrun · +M min", phase pill untouched), dedicated `/recovery` route with Reanimated `MM:SS` countdown. | #121, #122 |

### Mustafa — frontend / UI

| Task | What | PR |
|---|---|---|
| **S4.1** | **Stats screen (historical only)** — Hero weekly score, three Summary cards (streak / personal best / distractions per hour), regime-gated *"learning your rhythm"* badge under 7 sessions, pull-to-refresh, recent-sessions list. TanStack `QueryClientProvider` mounted at the root; `/focus` onDone invalidates `['stats']`. | #118 |
| **S4.2** | **Local notifications** — `expo-notifications` configured, end-of-break reminder scheduled at session end, optional daily session-start reminder at the Q3 preferred time. Permission requested only on a deliberate schedule, never on app open. | #106 |
| **S4.3** | **Offline indicator + L18 copy fix** — `useIsOnline()` over `expo-network` (conservative: only `false` on explicit evidence), `OfflineIndicator` calm pill wired into Home and Stats headers; Friends placeholder copy aligned to L18 (no leaderboard / friend-list promises). | #119 |

### Shared / cross-cutting

- **Recovery is now a screen, not text** (#122). The original summary's static *"Recovery · 11 min recommended"* line was disappearing in 8s with no countdown — found in sim testing. Split into: 8s summary stats glance → dedicated `/recovery` route with the live countdown + Mark-task-done + Start-next/Skip. **Option 7** — task completion moved off `/focus` and off the summary onto the recovery dwell space, where the user has minutes to make the call instead of seconds (**L19**).
- **The bug-audit train** (#123, #124). A 4-agent parallel audit after #120–#122 surfaced 30+ real findings; the Critical + High tier shipped as #123 (sign-out leakage across stores + queryClient, Resume edges, error surfaces), then the Medium UX + Low polish + the L21 recovery-threshold landed as #124. Five-PR stack against `main` at peak.
- **Math identity behind "the timer always says 72 min"** (L20). A 25-min easy task and a 50-min hard task can both produce a 72-min suggestion — the `0.85` multiplier appears in both `difficulty_mod` (hard) and `time_match_mod` (off-bucket), so different inputs converge. Not a formula bug; a missing orchestration constraint. `TASK_ESTIMATE_BUFFER = 1.5` cap in `compute.ts` solves it without touching the frozen `coldStart.ts`.

---

## Decisions

### Locked this week
- **L16 — Session lifecycle (end-early + kill/restore + overrun + break recompute).** Three end paths: DONE / end-early Save+Discard / kill→Resume+Save+Discard. Saved partials count for stats + streak (only **discarded** sessions never write a row). Migration 002/003 + `services/session/finalize.ts` as the single assembly point. *Date: 2026-05-27.*
- **L17 — Recovery is skippable, with modeled debt** (resolves O7). `recovery_mod = 0.85 + 0.15 × clamp(gap/break, 0, 1)`; combined `depletion_mod = max(0.75, fatigueMod × recoveryMod)` applied as a post-modifier on the cold-start output. Frozen `coldStart.ts` constants untouched. *2026-05-27.*
- **L18 — Strategic pivot: social-as-core (focus partnership), phased.** Phase A friend-pairing built in W7; W8 beta is the market read; one-step revert to solo-first + the session card if the read fails. Mechanics in tasks, not in locks. *2026-05-27 / committed 2026-05-28.*
- **L19 — DONE doesn't auto-promote the task; task completion is explicit.** A finished session does NOT mean a finished task; multi-session tasks are the normal path. Mark-task-done lives on the recovery screen (post-flow, with dwell time), not on `/focus`. *2026-05-29.*
- **L20 — Task-estimate cap on the session recommendation.** `focus = min(formula, ceil(estMinutes × 1.5))` at the orchestration layer; never inside `coldStart.ts`. Closes the "25-min task → 72-min suggestion" UX failure surfaced in sim testing. *2026-05-29.*
- **L21 — Skip recovery for sub-5-min DONEs.** `recoveryBreakMinutes(actual)` returns 0 below `MIN_FOCUS_FOR_RECOVERY = 5`; the summary routes straight to Home. The 5-min break floor was calibrated for real focus (≥ 15 min), not edge cases. *2026-05-29.*

### Effectively closed this week
- **O6 — Streak across time-zone change.** Implemented per the default — device local time. Move to a formal Locked entry next week (one-line spec edit, deferred only because the implementation matches the default).

### Still open (by design, later weeks)
- **O8 / O9 / O10** — all post-MVP. · Per L18, **O5 (friend-graph schema)** is superseded by the partnership edge in W7.

---

## Notable findings & gotchas (so we don't relearn them)

- **`useActiveSessionStore.hydrate()` was never called anywhere.** Found via sim testing the kill→Resume path (Bug #7, PR #122): clock froze at `00:00` on resume because the store was empty in memory even when MMKV had a session, and `focus.tsx`'s mount-effect had `[]` deps so it never re-fired when the task store eventually hydrated. Fixed by hydrating both stores at boot in `app/index.tsx` and changing the deps to `[plan, task?.id]` with a `useRef` guard. A second related case (Resume on a task the user deleted while killed) was found in the audit and fixed in #123 — `focus.tsx` now falls back to the dangling `ActiveSession.task` snapshot.
- **`signOut()` only reset one of four stores.** User A's tasks / settings / dangling session / TanStack stats cache all survived to User B's first screens — surfaced by the audit, fixed in #123. The LLM cache (`floq.llmCache.*`) deliberately stays per L13 (derived, non-PII).
- **The 5-min break floor was calibrated for real focus, not edge cases** (L21). A 3-min DONE was earning the same 5-min mandated break as a 22-min DONE — break ÷ focus = 167%. The 5-min minimum useful recovery is correct *if* the user expended real cognitive resources; below ~5 min they didn't. Fix lives in `overrun.ts`, the frozen `coldStart.ts` constants are unchanged.
- **The "Recovery's almost up" notification needed three cancel sites, not one.** Initially wired in `useStartSession.launch` (skipping into a new session); the audit caught two more — `/recovery`'s Skip + Start-next, and `RestoreSessionPrompt.onResume` (a long-killed session can still have a stale break reminder armed). All four paths now call `cancelBreakReminder()`.
- **Negative weekly hero on day one is the M4.1 formula working as designed.** A single short session with 1 distraction can produce `−19`; the rolling-7 mean can sit negative. The 23-min penalty cite is frozen. The display question — median vs mean, "focus debt" framing, sub-N-min filtering — is real and tracked as a separate spec discussion, not patched in W4.
- **Mohamed took the UI for this lifecycle arc**, deviating from the usual M→S split per L16's note. The PR train (#120–#124) is service + UI bundled because the audit feedback loop was tight (sim → finding → fix in the same session) and the UI was structurally coupled to the lifecycle services. Normal M→S handoff resumes in W5.

---

## Process / conventions in force

- `main` is the integration branch; **feature branch → PR → merge**, **one PR = one concern** — but the W4 lifecycle arc legitimately spanned a 5-PR stack (#120 → #121 → #122 → #123 → #124) because each tier was its own concern (services, then UI, then audit-driven fixes). Stacked PRs retargeted up the chain as each merged.
- **Done = `npm run typecheck` clean + `npm test` green** before claiming a task complete. W4 closed at **293/293 tests**.
- The **4-agent parallel audit pass** as a new working pattern: after a major arc lands, fan out parallel read-only Explore agents (E2E session, pre-session, stats/settings/design-system, state-sync/edges), de-dup, validate spot-checks against the actual code (several findings were false positives), tier by severity, ship Critical + High first.

---

## Egypt readiness

The "Egypt gap mitigation" checklist in `tasks.md` is now closed — all M-tasks on the list except W5's M5.2 are shipped:

- ✅ M1.2 (cold-start), ✅ M1.3 (TFLite spike), ✅ M2.1 (warming), ✅ M3.1 (phases), ✅ M3.2 (distractions), ✅ M3.3 (compute), ✅ M4.1 (focus score), ✅ M4.2 (SQLite), ⏳ M5.2 (regime router — W5).

Mohamed can leave at end of W4 with the brain running offline, the deployment path certified, and the lifecycle data + UI complete. W5–W8 work (forecast service, TFLite v1 retraining, partner edge per L18) is async-friendly.

---

## What's next — Week 5 (preview)

- **Mohamed:** **M5.1** EWMA forecast service (alpha tunable, gated < 7 sessions) · **M5.2** regime router (cold / warming / mature dispatch — closes Egypt-gap checklist) · **M5.3** TFLite model v1 training + deployment · **M5.4** warming blend wired into `computeSessionPlan` behind the same signature.
- **Mustafa:** **S5.1** Stats screen historical complete (all M4.3 cards populated, polish pass) · **S5.2** regime-gated forecast UI states (cold badge / warming wide bands / mature tight bands).
- **Carry from W4:** formal close of **O6** (one-line spec edit). · The negative-weekly-hero display discussion (median vs mean / framing) — not a code change, a spec call.
