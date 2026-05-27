# shared/spec/decisions.md

Living document. Every architectural decision lives here. Two sections: **Locked** (don't reopen without writing a new entry) and **Open** (must be resolved by the date listed).

## How to use this file

- Before doing anything that touches an Open decision, resolve it here first.
- When you resolve an Open decision, move it to Locked and add the date + reasoning.
- Never silently change a Locked decision. Add a new Locked entry that supersedes it.

---

## Locked decisions

### L1 — Cross-platform from day one via React Native + Expo

**Date locked:** v0.3 blueprint
**Reasoning:** Android post-MVP requires no rewrite. Expo speeds iteration and TestFlight builds. `react-native-fast-tflite` works in managed Expo via dev client, so we stay managed.

### L2 — On-device ML, no server inference

**Date locked:** v0.3 blueprint
**Reasoning:** Cost (zero paid inference), privacy (no behavioral data leaves device), latency (instant). TFLite is the deployment target.

### L3 — Three-regime router for cold start

**Date locked:** v0.3 blueprint
**Reasoning:** Avoids the two bad outcomes — generic 25/5 timer (betrays the premise) or confident predictions from 1 session (looks stupid). See `ml-regimes.md`.

### L4 — Friends-only social graph for MVP

**Date locked:** v0.3 blueprint
**Reasoning:** Smallest privacy surface. New users default to private profile. Public profiles post-MVP only.

### L5 — Pomodoro is wrong for cognitive work

**Date locked:** v0.3 blueprint
**Reasoning:** See `science.md`. A 25-minute hard cap interrupts at the worst possible moment. Anyone adding a 25-minute cap is building a different product.

### L6 — Zustand for client state, no Redux

**Date locked:** v0.3 blueprint
**Reasoning:** Scope doesn't justify Redux's overhead. Zustand is lightweight, zero-boilerplate, easy to test.

### L7 — Plain StyleSheet + tokens, no NativeWind/styled-components

**Date locked:** v0.3 blueprint
**Reasoning:** Native-feeling minimal aesthetic. Performance. Fewer deps. The design system in `mobile/theme/` is the abstraction.

### L8 — EWMA for the MVP forecast, LSTM/attention is post-MVP

**Date locked:** v0.3 blueprint
**Reasoning:** Data volume in W1–W8 doesn't justify a sequence model. EWMA is honest about uncertainty (via wide bands in warming regime).

### L9 — Expo SDK 55 (stable, locked exact)

**Date locked:** 2026-05-23
**Reasoning:** Latest stable on date of kickoff. RN 0.83.6, React 19.2.0,
New Architecture only. Briefly initialized on SDK 56 beta but reverted — TFLite
is on the critical path and we're not willing to be the canary for a beta SDK
plus a Nitro-based native module. Re-evaluate upgrade to SDK 56 post-MVP, once
it's stable and react-native-fast-tflite has confirmed compatibility.
Pinned exact (no tilde) in mobile/package.json.

### L10 — LLM provider: free-tier fallback chain (resolves O1)

**Date locked:** 2026-05-24
**Decision:** No single provider. `parseTasks(input)` is provider-agnostic and tries a waterfall of **permanent free tiers**, each falling back to the next on rate-limit/error:

> Gemini Flash (primary) → Groq (Llama) → OpenRouter `:free` → manual entry.

**Reasoning (live data, 2026-05-24):**
- OpenAI and Anthropic have **no usable permanent free tier** (OpenAI ~3 RPM + free trial credits discontinued; Anthropic $5 one-time console credits only) — both excluded from the free chain.
- **Gemini (AI Studio):** ~15 RPM, ~1M tokens/day, ~1,500 req/day, permanent, no card — most generous; alone covers all of beta (<50 users).
- **Groq:** 30 RPM / 6K TPM / up to 14,400 req/day, very fast (open-source Llama models).
- **OpenRouter:** ~28 `:free` models, 20 RPM, 50 req/day (<$10 credits) → 1,000/day after.
- No reputable hosted LLM is free *and* unlimited. "Unlimited" proxies (ApiFreeLLM, Puter.js) route user task text through unvetted third parties — **rejected on privacy grounds** (conflicts with L4). Self-hosting (Ollama) is the only truly-unlimited path; post-MVP option if free tiers choke.
- `llm_cache/{hash}` (see `schema.md`) reduces calls further.

**Implementation:** chain config + provider-agnostic `parseTasks()` scaffolded in `mobile/services/llm/provider.ts`; HTTP calls + zod validation land in **M2.3**. ⚠️ M2.3 must decide **client-direct vs cloud-function proxy** — embedding provider keys in the client bundle exposes them; prefer a proxy, or accept the beta risk explicitly.

**Sources:** apiscout.dev free-ai-apis-developers-2026 · pecollective.com Gemini free-tier guide · tokenmix.ai Groq free-tier-limits-2026 · costgoat.com openrouter-free-models · github.com/cheahjs/free-llm-api-resources

### L11 — Mohamed's Egypt plan: normal schedule (resolves O3)

**Date locked:** 2026-05-24
**Decision:** No special plan or async-gap mitigation needed. Mohamed works a **normal schedule** from Egypt (June–August) with no expected disruption to velocity. The weekly plan in `tasks.md` proceeds unchanged.
**Reasoning:** The original concern (a focus gap during travel) does not materialize — Mohamed confirmed normal availability. The front-loading already done (M1.2 cold-start, M1.3 TFLite spike) stands as insurance, not as a forced mitigation. The "Egypt gap mitigation" section in `tasks.md` is retained as a safety net but is not driving scheduling. The W3 TFLite spike was non-negotiable regardless and is ✅ done (M1.3).

### L12 — LLM key handling: client-direct, accept beta risk (resolves the M2.3 sub-decision flagged in L10)

**Date locked:** 2026-05-25
**Decision:** `parseTasks()` calls the LLM providers **directly from the client** (no proxy) for the TestFlight beta. The provider API key is read at runtime from an `EXPO_PUBLIC_` env var, which inlines it into the JS bundle where it is extractable. We accept that risk for beta, mitigated as below. Supersedes the "prefer a proxy / do NOT use `EXPO_PUBLIC_`" lean in `provider.ts`'s W1 note.

**Beta posture (defense in depth, no backend):**
- **Two-provider chain.** Gemini 2.5-flash-lite primary (best quality; 15 RPM / 1,000 RPD) → Groq `llama-3.1-8b-instant` fallback. Groq's free tier gives that model **14,400 RPD** (14× every other Groq model — see the table in L10's notes), so it absorbs overflow once Gemini's 1,000/day is spent: combined ceiling ≈ 15,400 parses/day, ample for beta. OpenRouter stays unconfigured (optional third link).
- **Gemini key restriction.** Restricted in Google Cloud to (a) the iOS bundle id `com.floq.app` and (b) the Generative Language API only — a stolen Gemini key is largely unusable elsewhere.
- **Groq key is NOT restrictable.** Groq has no bundle-id / referrer restriction, so `EXPO_PUBLIC_GROQ_API_KEY` ships fully unrestricted — a leaked Groq key is freely usable (up to its free quota) until rotated. This is the main downgrade from a single-key posture; accepted for beta because it is free-tier and rotatable.
- **Rotatable + monitored.** Both keys are free-tier (no financial exposure); set usage alerts; rotate on any sign of abuse.
- **Cache.** `floq.llmCache.{sha256}` in MMKV reduces call volume before either provider is hit.

**Residual risk accepted:** client-shipped keys can be extracted. The Gemini key's bundle-id restriction raises the bar (not bulletproof against a spoofed bundle id); the Groq key has no such restriction. Bounded because both are free-tier and rotatable. The proxy (before public launch) removes this for good.

**Revisit before any public (non-beta) launch:** move to a **Cloud Function proxy + Firebase App Check** (keys server-side, attested clients). Middle path worth evaluating then: **Firebase AI Logic** (client calls Gemini via Firebase with App Check, no raw key in the bundle) — but it only covers Gemini, so it would narrow the L10 multi-provider chain.

**Model:** `gemini-2.5-flash-lite` — chosen over the (now deprecated) `gemini-2.0-flash` and over `gemini-2.5-flash` because it has the most generous free tier (15 RPM / 1,000 RPD vs 10 / 250) and is Google's recommended model for extraction/classification, which is what brain-dump parsing is. Gemini structured output (`responseSchema`) forces the JSON shape; zod still enforces value ranges. Bump to `gemini-2.5-flash` only if parse quality proves insufficient.

**Implementation:** M2.3 — HTTP in `provider.ts` (`callProvider`), orchestration in `parseTasks.ts`, zod validation in `types.ts`, cache in `cache.ts`, system prompt in `prompts.ts`.

### L13 — Auth: email + Google live, Apple + phone deferred; client-side skeleton write (resolves the M2.4 "pick one" sub-decision)

**Date locked:** 2026-05-25
**Decision:** M2.4 ships **email/password + Google** sign-in. **Apple and phone are scaffolded** (the functions exist and throw `AuthNotConfiguredError` until enabled). The `users/{uid}` skeleton doc is created **client-side** on first sign-in — no Cloud Function.

**Method scope + why:**
- **Email/password** — live. The only method needing zero native work (pure Firebase JS SDK), so it unblocks Mustafa's S2.0 immediately and is verifiable on the current dev client.
- **Google** — live, native. Free of charge, but requires the `@react-native-google-signin/google-signin` dep + a dev-client rebuild + OAuth client IDs configured in Firebase/Google Cloud. Token flow: native `signIn()` → `GoogleAuthProvider.credential(idToken)` → `signInWithCredential`.
- **Apple** — **deferred** until the $99 Apple Developer Program membership is active (needed for the Sign-in-with-Apple capability *and* the W8 TestFlight ship regardless). Deliberately **not** installing `expo-apple-authentication` yet: adding the entitlement (`ios.usesAppleSignIn`) before the membership can block device builds. Real impl is in a comment block in `auth.ts`.
- **Phone** — **deferred**. Not cleanly free: SMS is billed per-message on the **Blaze** plan (small, region-limited free allowance), and the JS-SDK RN reCAPTCHA path is deprecated/unmaintained. Revisit post-MVP, likely via `@react-native-firebase`.

**Skeleton write: client-side (not a Cloud Function).** On first sign-in `ensureUserDoc()` writes the `users/{uid}` skeleton (`uid, email, display_name, created_at, has_seen_intro:false, privacy:'private'`, + `apple_id?`) only if the doc is missing. Chosen because: (a) a Cloud Function trigger needs the **Blaze** plan — contradicts staying free; (b) the M2.2 owner-only rule already authorizes it (the user is authed right after create); (c) no cold starts, works offline. Trade-off: a `users/{uid}` doc is created only when the user opens *our* app (fine — there is no other entry point in MVP).

**Persistence:** Firebase JS SDK `initializeAuth` + `getReactNativePersistence` backed by an **MMKV adapter** (`services/firebase/authStorage.ts`), avoiding an `@react-native-async-storage/async-storage` dependency. `getReactNativePersistence` is reached via a typed cast (RN-only export, absent from the web types tsc resolves).

**Sign-out teardown:** `signOut()` = `firebaseSignOut` + best-effort Google revoke + reset of Zustand stores / app MMKV keys. The **LLM cache (`floq.llmCache.*`) is intentionally preserved** (derived, non-PII, survives account switches).

**Revisit before public launch:** evaluate a Cloud Function `onCreate` trigger as a backstop if non-app signup paths ever exist; reconsider phone via `@react-native-firebase` if demanded.

**Implementation:** M2.4 — `services/firebase/auth.ts` (methods + `useCurrentUser`), `userDoc.ts` (skeleton), `authStorage.ts` (MMKV persistence), `routing.ts` (`resolveStartRoute`).

### L14 — Task model: brain-dump + understated manual entry, full CRUD, M→S split

**Date locked:** 2026-05-25
**Decision:** Tasks are a first-class, persisted entity with **full CRUD** and **two co-equal creation paths** — LLM brain-dump (prominent) and **manual entry** (deliberately understated, *not* an LLM-failure fallback). The data layer is owned by **M** (Mohamed); the add/manage UI by **S** (Mustafa) — a sequential M→S handoff.

**Why (the gap this closes):** The original plan specified task *creation* via the LLM (M2.3) plus a manual *fallback* shown only on LLM failure (S2.4), but left the queue store, persistence, CRUD, and lifecycle **unowned** — no `useTaskStore` task existed, M4.2 covered sessions only, and `session-flow.md` §"Task promotion" had no implementer. This entry makes the task feature explicit and owned.

**CRUD shape:**
- **Create** — `addTasks(ParsedTask[])` (LLM batch) and `addTask(input)` (single manual).
- **Read** — `topTask` + `hiddenCount` selectors (drive Home's "one visible / +N hidden").
- **Update** — edit `title` / `difficulty` / `est_minutes`, `reorder`, `markDone`.
- **Delete** — `removeTask`.
- **Lifecycle** — on Done, `markDone(topTaskId)` removes the current task and auto-promotes the next, per `session-flow.md` §Task promotion.

**Phasing (matches the W2/W4 split already implied by S2.4's note):**
- **W2 (M2.5):** Zustand `useTaskStore` + pure `services/tasks/queue.ts` + MMKV atomic blob `floq.tasks` (mirrors M2.2 onboarding). MMKV is the source of truth.
- **W4 (M4.2, extended):** SQLite `services/storage/tasks.ts` becomes the source of truth; MMKV demotes to a fast-read cache; async mirror to Firestore `users/{uid}/tasks` (owner-only). `schema.md` un-provisions that collection then.

**Privacy invariant (unchanged, per L4):** task titles never leave the device to friends / `social`; the `users/{uid}/tasks` mirror is owner-only.

**Implementation:** new **M2.5** (data layer) + **S2.6** (manual-add + CRUD UI); **M4.2** extended to "session **+ task** persistence"; **S2.4** / **S3.3** acceptance tightened. UI surfaces: a shared `ManualTaskForm` (used by both first-class manual add and the LLM-failure path) + a `TaskQueueSheet` opened from the "+N hidden" caption.

### L15 — Background-during-session policy: a user setting (resolves O4)

**Date locked:** 2026-05-26
**Decision:** The background-during-session policy is a **user-configurable setting**, not one hardcoded rule. `settings.backgroundPolicy`:
- **`forgiving`** (default) — app backgrounded **>30s** during an active session = 1 distraction. Forgives quick app-switches.
- **`strict`** — **any** background during a session = 1 distraction.

One distraction per background→foreground episode, logged via the M3.2 funnel (batched to session end). Only `AppState 'background'` starts the clock; `'inactive'` (app-switcher peek, notification shade) is ignored as transient.

**Option (c) "exempt phone calls / alarms" is DEFERRED.** The original O4 framing assumed "iOS gives us the reason" — it does not via `AppState`, which only reports active/background/inactive, not *why*. Detecting a call/alarm needs native **CallKit / `CXCallObserver`** (a custom native module + dev-client rebuild), which conflicts with managed Expo (L1/L9). Revisit post-MVP if users complain that calls cost them distractions. Until then a call that backgrounds the app >30s counts (matches `session-flow.md`: "still counts as a distraction by default").

**Ownership (M→S split):** **M3.4 (Mohamed)** owns the service (`services/session/backgroundPolicy.ts`), the setting (`services/settings/` + `useSettingsStore`), persistence, and the default. **S3.5 (Mustafa)** owns the picker UI bound to `useSettingsStore`; **S3.4 (Mustafa)** consumes the service's `onBackgroundDistraction` callback for the on-return toast.

**Surfacing:** the on-return toast (S3.4) is the primary feedback; the summary's total distraction count includes background ones. Per-distraction *source* tagging (to label "N from backgrounding" distinctly) is deferred — it would change M3.2's `distractions: number[]` model and the frozen `schema.md` `distraction_timestamps`.

**Edge cases (no special-casing):** screen lock → iOS sends `background`, so the time counts toward the threshold ("only background time counts"). App killed while backgrounded → no log for that episode; the session is restored from M3.2's MMKV mirror and the discard/save prompt is a separate frontend concern.

### L16 — Session lifecycle: end-early (abandon), kill/restore, overrun + break recalculation

**Date locked:** 2026-05-27
**Decision:** A session has **two distinct end intents** plus an **overrun** concept, and an in-flight session **survives app-kill** and is recoverable. This closes the gap that the only way out of `/focus` was DONE (which completed the task and removed it from the queue) — and that the session-flow.md "app killed → discard or save" edge case had no implementer.

**Three end paths:**
1. **DONE (finished).** Always available. Completes the session: writes a full record (`completed: true`), `markDone` promotes the next task, focus score computed (M4.1), recovery break **recomputed from actual minutes** (below), streak credit, → summary. If `actual > planned`, the excess is recorded as `overrun_minutes`.
2. **End early / "I stopped" (didn't finish).** A separate, understated affordance. **Prompts each time** — *Save progress* or *Discard*:
   - **Save** → writes a record with `completed: false`. Its **focus score is still computed (M4.1) and counts toward the weekly / leaderboard score** — real focus time happened, the user just had to leave before finishing the task (revised per Mohamed 2026-05-27). Task **stays in the queue** — no `markDone`.
   - **Discard** → no record written. Task stays.
   - Either way → returns to Home; **no recovery break enforced** (it wasn't a completed focus session).
3. **Kill mid-session + relaunch.** On next launch, detect the dangling active session (M3.2's MMKV mirror) and **prompt: Resume / Save / Discard.** Resume re-enters `/focus` with wall-clock-correct elapsed; Save writes a `completed:false` partial (as in path 2); Discard drops it. The task is preserved in all three.

The DONE-vs-end-early distinction is the user's **intent**, not the elapsed time: a user can finish (DONE) before the suggested time, or stop (end-early) after it. "No pause" (L5 / session-flow.md #3) is unchanged — end-early is a deliberate, confirmed *termination*, not a pause.

**Overrun + suggested-stop UX (resolves the "past suggested time" rough edges):**
- The session screen shows the **suggested stop time** and progress toward it.
- Once `elapsed ≥ plan.focusMinutes`, surface an explicit **overrun** state + affordance — replacing the current pre-Done "Recovery" mislabel (the timer kept counting and the pill flipped to Recovery even though the user was still focusing). This overrun state is **derived in the UI/helper layer from `elapsed` vs `plan.focusMinutes`** — it does **NOT** add a phase to, or alter the boundaries of, the FROZEN `phases.ts` (root CLAUDE.md safety rule).
- At any saved end, `overrun_minutes = max(0, actualFocusMinutes − plannedFocusMinutes)`.

**Recovery-break recalculation (extends `timer.md`; constants UNCHANGED):**
- The recovery break shown after DONE is recomputed from **actual** focus minutes at session end: `break = clamp(round(actualFocusMinutes × 0.22), 5, 25)` — the **same `0.22` ratio and `5/25` clamps frozen in `coldStart.ts`**, only the input changes (actual minutes, not the session-start suggestion). **No new constant, no value change** — the frozen formula is untouched; if the constants aren't already exported they get an *export-only* lift (flagged per the safety rule). This supersedes the implicit "break is computed once at start" behavior **for the recovery break only**; the session-*start* recommendation is still the cold/warming/mature output.
- **Cross-ref O7** (enforced vs skippable recovery): L16 only sets the break *duration*; whether recovery is enforced/skippable stays O7's open call.

**Data model (SQLite, append-only migrations — root CLAUDE.md safety rule):**
- **Migration 002:** `sessions.completed INTEGER NOT NULL DEFAULT 1` (existing/Done rows backfill to completed). Firestore mirror gains `completed: boolean`.
- **Migration 003:** `sessions.overrun_minutes INTEGER NOT NULL DEFAULT 0`. Firestore mirror gains `overrun_minutes: number`.
- `break_minutes` already exists — store the recomputed value there.
- `CompletedSession` gains `completed: boolean` and `overrunMinutes: number`.

**Invariants:** the **weekly focus score / leaderboard includes partial (`completed:false`) sessions** — real focus time is credited (a focus score is computed for every saved session). The **streak** counts any **saved** session — `completed: true` OR a saved `completed:false` partial (the user tapped *Save progress* because real focus happened); only **discarded** sessions never count (revised per Mohamed 2026-05-27, **supersedes** session-flow.md "Completed = tapped Done"). No minimum-minutes guard for MVP (saving is the qualifier; revisit post-MVP if abused). All saved sessions (partials included) are kept for ML/history and are owner-only like every session (`floq-firestore` rule #3) — never surfaced to friends/social.

**Ownership (M→S split, per L14/L15):** **M4.5 (Mohamed)** — active-session lifecycle (`abandonSession`, restore detection/resume), partial-session write, migration 002, streak/aggregation exclusion. **M4.6 (Mohamed)** — overrun computation + break recalculation service, migration 003, planned/actual/overrun recording. **S4.4 / S4.5 (Mustafa)** — the end-early & restore **prompt dialogs**, the suggested-stop + progress display, and the overrun affordance on `/focus`, wired to the M services.

**Implementation:** new **M4.5** + **M4.6** in `tasks.md`. `session-flow.md` (edge cases / Task promotion) and `timer.md` (recovery-break recalc note) to be updated by those tasks under owner review.

### L17 — Recovery is skippable, with a modeled recovery-debt cost on the next session (resolves O7)

**Date locked:** 2026-05-27
**Decision:** Recovery is **recommended and skippable, NOT hard-enforced** (resolves O7 → option **(b) skippable with friction**). The "friction" is honest and modeled: the system measures the **actual gap** between one session's end and the next session's start, and under-resting reduces the *next* session's focus recommendation. It never blocks the Start button and never docks the focus score already earned. **Supersedes** `timer.md` rule #4 and `session-flow.md` rule #4 ("recovery enforced / next session blocked / Start disabled").

**The model (gap clock + `recovery_mod`):**
- `recommendedBreak` = the recovery break of the *previous* session, recomputed from its actual focus minutes per **L16** (`clamp(round(prevActualFocus × 0.22), 5, 25)`).
- `actualGap` = minutes between the previous session's `ended_at` and this session's start (the "gap clock").
- `recovery_fraction = clamp(actualGap / recommendedBreak, 0, 1)` — the fraction of the needed rest actually taken. A **linear ramp** (simple + honest about uncertainty, matching the EWMA philosophy **L8**; the literature's true shape is decelerating-to-asymptote — an exponential refinement is post-MVP).
- `recovery_mod = RECOVERY_FLOOR + (1 − RECOVERY_FLOOR) × recovery_fraction`, with **`RECOVERY_FLOOR = 0.8`**.
  - Rested fully (gap ≥ recommendedBreak) → `recovery_mod = 1.0`, no penalty. *(The "11-min break, I started after 15 min" case: implicitly rested → zero cost, and the score already earned is untouched.)*
  - Restarted immediately (gap ≈ 0) → `recovery_mod = 0.8`, the maximum ~20% trim.
  - No previous session inside the recovery window (first session of the day / long gap) → `recovery_mod = 1.0`.

**Where it lives (respects the frozen formula):** `recovery_mod` is applied as a **post-modifier on the regime router's recommendation inside `computeSessionPlan`** — **NOT** inside `coldStart.ts`. It **operationalizes `context.hours_since_last`**, an input *already listed* in `timer.md` ("proxy for recovery") but never previously wired into a formula. So the frozen cold-start constants are untouched; the recovery effect is a separate, clearly-sourced, regime-agnostic multiplier applied **before** the final `clamp(15, 90)` (the 15-min lower clamp still bounds the worst case).

**`RECOVERY_FLOOR = 0.8` — justification + status:** the research below establishes that incomplete recovery monotonically degrades subsequent cognitive performance (existence + direction are solid); it does **not** hand us an exact %-per-minute. So `0.8` is a **calibrated constant** (like EWMA `alpha = 0.3` — "tune in testing"), chosen to sit in the same conservative band as the formula's existing mods (fatigue 3rd+ `0.8`, time-mismatch `0.85`, hard-difficulty `0.85`): it *nudges*, it doesn't cripple. Revisit with real session data (post-MVP / QA).

**Interaction with `fatigue_mod` (calibration note):** `fatigue_mod` (sessions-today count) captures cumulative *daily* depletion; `recovery_mod` captures *rest quality* before this session — separable (rest well between your 2nd and 3rd session: `fatigue_mod = 0.8`, `recovery_mod = 1.0`). They *can* compound (poorly-rested 3rd session → `0.8 × 0.8 = 0.64`); **M4.7 must validate** the combined floor doesn't over-penalize. The `15`-min clamp is the hard backstop.

**UI (S handoff):** the recovery screen shows the recommended break + a calm one-line note (e.g. *"Starting before your recovery is up tends to shorten your next focus window."*) and surfaces the gap / "time since last session." Skipping is one tap — no nag, no block.

**Science (recovery is a function of rest taken, not of a button press):**
- Short breaks restore vigor but not full cognitive resources; longer breaks restore more — break length governs recovery ([Albulescu et al., 2022, PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0272460)).
- Depleted attentional/vigilance resources **self-recover when allowed to rest**, on a **decelerating trend to an asymptote** ([Ralph et al., "Rest is best", Cognition 2014](https://www.sciencedirect.com/science/article/abs/pii/S0010027714001929)).
- Mental fatigue recovers only **partially over ~20 min**, not back to baseline; recovery is gradual ([Development and recovery time of mental fatigue, 2021](https://www.sciencedirect.com/science/article/abs/pii/S0301051121000673)).
- Insufficient recovery impairs the subsequent task ([Cognitive tasks impair subsequent performance, PMC9786280](https://pmc.ncbi.nlm.nih.gov/articles/PMC9786280/)).

**Ownership:** **M4.7 (Mohamed)** — gap clock, `recovery_mod` in `computeSessionPlan`, skippable-recovery gating (un-block Start), recovery-gap recording. **S (Mustafa)** — recovery-screen note + skip affordance + gap display.

**Implementation:** new **M4.7** in `tasks.md`. `timer.md` (rule #4 + the `hours_since_last` row → operationalized) and `session-flow.md` (rule #4) updated by M4.7 under owner review.

---

## Open decisions — must resolve by end of W1

### O1 — LLM provider ✅ RESOLVED (2026-05-24)

Moved to Locked — see **L10**. Outcome: a free-tier fallback chain (Gemini → Groq → OpenRouter), not a single provider. OpenAI/Anthropic dropped — no usable permanent free tier.

### O2 — Expo SDK version to pin

**Must resolve by:** End of W1
**Default if not resolved:** Latest stable that supports `react-native-fast-tflite`. Lock the exact version in `mobile/package.json` and here.
**Owner:** Mustafa

### O3 — Mohamed's Egypt plan ✅ RESOLVED (2026-05-24)

Moved to Locked — see **L11**. Outcome: normal schedule, no gap, no special mitigation.

### O4 — Background-during-session policy ✅ RESOLVED (2026-05-26)

Moved to Locked — see **L15**. Outcome: a **user-configurable setting** (`forgiving` 30s default / `strict` any-background), not one hardcoded rule. Option (c) "exempt calls/alarms" deferred — `AppState` doesn't expose the reason; it needs native CallKit (conflicts with managed Expo, L1/L9). Service + setting = M3.4 (Mohamed); picker UI = new S3.5 (Mustafa).

### O5 — Friend graph schema

**Must resolve by:** End of W6 (before the friends screen in W7)
**Options:**
  - **(a) Bidirectional doc** — `friendships/{uid_a}_{uid_b}` with sorted UIDs. One write per pair.
  - **(b) Subcollection** — `users/{uid}/friends/{friend_uid}`. Two writes per add.
**Owner:** Mohamed
**Notes:** (a) is cheaper but harder to query for "list my friends". (b) is more standard. Mostly comes down to security-rule complexity.

### O6 — Streak across time-zone change

**Must resolve by:** End of W4
**Default:** Streak follows device local time. May feel odd to frequent travelers; acceptable for MVP.
**Owner:** Mohamed
**Notes:** Revisit post-MVP. May need a "streak grace period" if users complain.

### O7 — Skippable break / enforced-recovery override ✅ RESOLVED (2026-05-27)

Moved to Locked — see **L17**. Outcome: recovery is **skippable, not hard-enforced** (option **b**), but the *friction* is a **modeled recovery-debt cost** on the next session — a `recovery_mod` (range `0.8`–`1.0`) driven by the actual end→start gap vs the recommended break, operationalizing the already-listed `hours_since_last` input — plus a calm UI note. Never a hard block, never a dock to the score already earned. Supersedes `timer.md` rule #4 / `session-flow.md` rule #4. Raised by Mustafa 2026-05-23.

### O8 — Revisit the 90-minute focus ceiling (and the 15/90, 5/25 clamps)

**Must resolve by:** Post-MVP (not blocking; MVP keeps the current clamps)
**Context:** The cold-start formula clamps the *recommendation* to 15–90 focus / 5–25 break. The 90 cap is research-backed (`science.md` Fact 3 — Kleitman ultradian). Note: the clamp bounds the *suggested* length, not how long the user can actually focus — there is no auto-stop at 90.
**Options:**
  - **(a) Keep 15–90 / 5–25** (current, research-backed) — _(default)_
  - **(b) Raise or remove the upper ceiling** — requires a new citation and risks recommending fatiguing sessions.
**Owner:** Mohamed
**Notes:** These are FROZEN constants (CLAUDE.md safety rules). Any change must update `science.md` with a new source and supersede this entry. Raised by Mustafa 2026-05-23.

### O9 — Fallback "classic" (non-flow) timer mode

**Must resolve by:** Post-MVP (new feature, out of MVP scope)
**Context:** Offer users who don't want the adaptive flow-science system a plain fixed-duration timer.
**⚠️ Conflicts with L5** ("Pomodoro is wrong for cognitive work") and the central design claim in `science.md` ("if you find yourself adding a 25-minute hard cap, you are building a different product"). Adopting this would require a new Locked entry that supersedes/qualifies L5.
**Options:**
  - **(a) No classic mode** (current) — the adaptive flow timer *is* the product. _(default for MVP)_
  - **(b) Opt-in classic/fixed-duration timer** — a settings toggle + a second timer path.
**Owner:** Both
**Notes:** Out of MVP scope. If pursued, write the superseding decision before any implementation. Raised by Mustafa 2026-05-23.

### O10 — Circadian-relative time matching (hours-since-waking, not wall clock)

**Must resolve by:** Post-MVP design spike (NOT blocking — MVP ships wall-clock bucketing in M3.3)
**Raised by:** Mohamed, 2026-05-26
**Context:** The cold-start `time_match_mod` (×1.0 if `context.hour_bucket === onboarding.preferred_time`, else ×0.85) currently compares two **wall-clock** concepts. Circadian alertness actually tracks **time since waking** + chronotype, not absolute clock time: "9am" is near-peak for a 05:00 riser and groggy for an 08:45 riser. Matching the user's *current circadian phase* to their *preferred energy window* should be more accurate than wall-clock matching.
**Why it's not a drop-in (the conflict):**
- Contradicts the frozen `timer.md` Inputs table row: `context.hour_bucket | current local time → morning / afternoon / evening / night`. A redefinition is a spec change and must supersede that row.
- **No wake-time data is collected.** Onboarding Q1–Q4 (`base_focus / distraction_level / preferred_time / use_case`) has no wake time. Needs either a **new onboarding question** ("when do you usually wake up?") — touching `onboarding.md`, Mustafa's S2.1 screens, `OnboardingAnswers`, and the seed mapper — or **inference from session history** (M4.2).
- `preferred_time` (Q3) is itself a wall-clock concept; it would have to be re-expressed in the same circadian frame to stay comparable.
- `HourBucket` feeds the locked ML feature vector (`ml/CLAUDE.md`); changing its meaning mid-stream breaks training-data continuity between cold-regime sessions and the TFLite model.
**Options:**
  - **(a) Keep wall-clock bucketing** — current MVP. Cutoffs morning 05:00–11:59 / afternoon 12:00–16:59 / evening 17:00–20:59 / night 21:00–04:59, in `mobile/services/session/compute.ts` `hourBucket()`. _(default)_
  - **(b) Circadian-relative bucket** — collect a wake anchor (onboarding Q or HealthKit / first-open inference), derive hours-since-waking → phase, re-express `preferred_time` in the same frame, update `timer.md` + the `ml` feature-vector doc.
**Owner:** Mohamed (timer/ML), with Mustafa for any onboarding-question UI.
**Notes:** MVP keeps (a). The derivation is isolated to `hourBucket()` behind `computeSessionPlan`'s `ctx` in `mobile/services/session/compute.ts`, so (b) can replace it without touching the frozen cold-start formula or S3.0. The frozen `time_match_mod` constants (1.0 / 0.85) are unaffected either way — only the bucket-derivation method changes.

---

## Decisions to revisit post-MVP (not now)

- Mid-session adaptation (post-MVP per blueprint).
- LSTM/attention forecast model (need 50+ sessions/user first).
- App Store launch timing (after 4–6 weeks TestFlight).
- Premium tier (only after 1000+ users).
- Apple Watch companion.
