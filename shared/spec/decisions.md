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

**Privacy invariant (unchanged, per L4):** task titles never leave the device to a partner / `social`; the `users/{uid}/tasks` mirror is owner-only.

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
   - **Save** → writes a record with `completed: false`. Its **focus score is still computed (M4.1) and counts toward the weekly partner-visible score** — real focus time happened, the user just had to leave before finishing the task (revised per Mohamed 2026-05-27). Task **stays in the queue** — no `markDone`.
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

**Invariants:** the **weekly focus score (partner-visible via `social`, per L18) includes partial (`completed:false`) sessions** — real focus time is credited (a focus score is computed for every saved session). The **streak** counts any **saved** session — `completed: true` OR a saved `completed:false` partial (the user tapped *Save progress* because real focus happened); only **discarded** sessions never count (revised per Mohamed 2026-05-27, **supersedes** session-flow.md "Completed = tapped Done"). No minimum-minutes guard for MVP (saving is the qualifier; revisit post-MVP if abused). All saved sessions (partials included) are kept for ML/history and are owner-only like every session (`floq-firestore` rule #3) — never surfaced to a partner; only the derived `social` summary is partner-visible.

**Ownership:** **M4.5 (Mohamed)** — active-session lifecycle (`abandonSession`, restore detection/resume), partial-session write, migration 002, streak/aggregation handling. **M4.6 (Mohamed)** — overrun computation + break recalculation service, migration 003, planned/actual/overrun recording. **M4.8 / M4.9 (Mohamed)** — the end-early & restore **prompt dialogs**, the suggested-stop + progress display, and the overrun affordance on `/focus`. *Mohamed is taking the UI for these features himself* (deviation from the usual M→S split, per his call 2026-05-27).

**Implementation:** new **M4.5** + **M4.6** in `tasks.md`. `session-flow.md` (edge cases / Task promotion) and `timer.md` (recovery-break recalc note) to be updated by those tasks under owner review.

### L17 — Recovery is skippable, with a modeled recovery-debt cost on the next session (resolves O7)

**Date locked:** 2026-05-27
**Decision:** Recovery is **recommended and skippable, NOT hard-enforced** (resolves O7 → option **(b) skippable with friction**). The "friction" is honest and modeled: the system measures the **actual gap** between one session's end and the next session's start, and under-resting reduces the *next* session's focus recommendation. It never blocks the Start button and never docks the focus score already earned. **Supersedes** `timer.md` rule #4 and `session-flow.md` rule #4 ("recovery enforced / next session blocked / Start disabled").

**The model (gap clock + `recovery_mod`):**
- `recommendedBreak` = the recovery break of the *previous* session, recomputed from its actual focus minutes per **L16** (`clamp(round(prevActualFocus × 0.22), 5, 25)`).
- `actualGap` = minutes between the previous session's `ended_at` and this session's start (the "gap clock").
- `recovery_fraction = clamp(actualGap / recommendedBreak, 0, 1)` — the fraction of the needed rest actually taken. A **linear ramp** (simple + honest about uncertainty, matching the EWMA philosophy **L8**; the literature's true shape is decelerating-to-asymptote — an exponential refinement is post-MVP).
- `recovery_mod = RECOVERY_FLOOR + (1 − RECOVERY_FLOOR) × recovery_fraction`, with **`RECOVERY_FLOOR = 0.85`**.
  - Rested fully (gap ≥ recommendedBreak) → `recovery_mod = 1.0`, no penalty. *(The "11-min break, I started after 15 min" case: implicitly rested → zero cost, and the score already earned is untouched.)*
  - Restarted immediately (gap ≈ 0) → `recovery_mod = 0.85`, the maximum ~15% trim.
  - No previous session inside the recovery window (first session of the day / long gap) → `recovery_mod = 1.0`.

**Where it lives (respects the frozen formula):** `recovery_mod` is applied as a **post-modifier on the regime router's recommendation inside `computeSessionPlan`** — **NOT** inside `coldStart.ts`. It **operationalizes `context.hours_since_last`**, an input *already listed* in `timer.md` ("proxy for recovery") but never previously wired into a formula. So the frozen cold-start constants are untouched; the recovery effect is a separate, clearly-sourced, regime-agnostic multiplier applied **before** the final `clamp(15, 90)` (the 15-min lower clamp still bounds the worst case).

**`RECOVERY_FLOOR = 0.85` — justification (resolved 2026-05-27 after a magnitude review):** the literature establishes the effect's *existence and monotonicity* (incomplete recovery degrades subsequent performance) but gives a **wide magnitude range** — the directly-relevant *supplementary rest-break* meta-analysis is **small** (pooled `g ≈ 0.14` on task quantity, [Scholz et al. 2018](https://www.researchgate.net/publication/309804103_impact_of_supplementary_short_rest_breaks_on_task_performance_-_A_meta-analysis)); the micro-break meta is small-to-moderate ([Albulescu 2022](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0272460)); only severe-fatigue *motor-skill learning* paradigms reach ~32% ([PMC6443347](https://pmc.ncbi.nlm.nih.gov/articles/PMC6443347/)), an extreme not representative of a focus-length nudge. So the floor is set at **`0.85` (max 15% trim), not `0.8`**: a *soft* mod matching the other soft/probabilistic mods (time-mismatch `0.85`, hard-difficulty `0.85`) rather than the strongest (3rd+ fatigue `0.8`) — appropriate because (a) the most applicable evidence is small and (b) `recovery_mod` is a new, unvalidated on-device signal that already overlaps `fatigue_mod`, so erring conservative avoids double-penalizing. Still a calibrated constant (EWMA-`alpha`-style) — revisit upward with real session data if 15% proves too gentle.

**Combined depletion floor (resolved 2026-05-27 — yes, floor it; don't lean on the 15-min clamp):** `fatigue_mod` (cumulative *daily* depletion) and `recovery_mod` (*rest quality* before this session) are **positively correlated** — skipping rest between sessions both lowers `recovery_mod` *and* is part of why a later session is fatigued — so multiplying them fully **double-counts** the back-to-back penalty (worst corner `0.8 × 0.85 = 0.68`, a 32% cut from depletion *alone*, before any other mod). We therefore **floor the product**: `depletion_mod = max(DEPLETION_FLOOR, fatigue_mod × recovery_mod)` with **`DEPLETION_FLOOR = 0.75`** (joint depletion penalty capped at 25%), applied in place of the two separate factors. The other mods (difficulty, time-match, distraction) are independent constructs and multiply freely. This degrades **gracefully** within the evidence band instead of slamming into the 15-min clamp — which now remains only a final hard backstop, not the mechanism. Both floors stay calibrated constants; revisit with real data.

**UI (S handoff):** the recovery screen shows the recommended break + a calm one-line note (e.g. *"Starting before your recovery is up tends to shorten your next focus window."*) and surfaces the gap / "time since last session." Skipping is one tap — no nag, no block.

**Science (recovery is a function of rest taken, not of a button press):**
- Short breaks restore vigor but not full cognitive resources; longer breaks restore more — break length governs recovery ([Albulescu et al., 2022, PLOS ONE](https://journals.plos.org/plosone/article?id=10.1371%2Fjournal.pone.0272460)).
- Depleted attentional/vigilance resources **self-recover when allowed to rest**, on a **decelerating trend to an asymptote** ([Ralph et al., "Rest is best", Cognition 2014](https://www.sciencedirect.com/science/article/abs/pii/S0010027714001929)).
- Mental fatigue recovers only **partially over ~20 min**, not back to baseline; recovery is gradual ([Development and recovery time of mental fatigue, 2021](https://www.sciencedirect.com/science/article/abs/pii/S0301051121000673)).
- Insufficient recovery impairs the subsequent task ([Cognitive tasks impair subsequent performance, PMC9786280](https://pmc.ncbi.nlm.nih.gov/articles/PMC9786280/)).

**Ownership:** **M4.7 (Mohamed)** — gap clock, `recovery_mod` in `computeSessionPlan`, skippable-recovery gating (un-block Start), recovery-gap recording. **M4.9 (Mohamed)** — recovery-screen note + skip affordance + gap display (Mohamed is taking the UI himself, per 2026-05-27).

**Implementation:** new **M4.7** in `tasks.md`. `timer.md` (rule #4 + the `hours_since_last` row → operationalized) and `session-flow.md` (rule #4) updated by M4.7 under owner review.

### L18 — Strategic pivot: social-as-core (focus partnership), phased

**Date locked:** 2026-05-27 (initial framing as bet); **plan committed:** 2026-05-28 (tasks + specs locked across `shared/spec/`, `mobile/CLAUDE.md`, `CLAUDE.md`, `.claude/skills/floq-firestore/`)
**Status — read this first:** The **plan is locked** — we are building Phase A in W7 and shipping it to TestFlight in W8. The W8 beta is a **market read** (do paired users out-retain solos?), not a re-decide gate. If the W8 read clearly fails, the **one-step revert** is to ship solo-first + the session card for App Store launch and demote the partnership to an optional feature; if the read is **ambiguous**, the default is also revert (don't advance to Phase B on weak data). The earlier rejected framing ("L18/L19/L20" locking detailed mechanics as product law) is **not** what's done here — mechanics live in Phase-A tasks (`tasks.md` M7.0 / M7.1b / S7.0 / S7.1b) and are normal, mutable engineering specs.

**Decision:** Reorganize the product around the **focus partnership**. Floq stops being "a solo focus app with a social layer" and becomes "a focus partnership made intelligent by the adaptive timer + on-device ML." Solo stays a fully-functional on-ramp (most people try solo first), but the product pulls toward pairing, because pairing is simultaneously the **install loop**, the **retention loop**, and the **moat** — the three things the solo plan structurally lacked.

**Why (the gap this closes):** the solo plan ships a good product with **no distribution mechanism** — a destination app, no virality, no network effect, plateaus as a lifestyle business. Pairing is the only element of this product that creates distribution (you invite a specific partner) AND retention (a partner is why you return on day 47) AND a moat (a pair edge + ML matching a solo-structured competitor can't copy). Full analysis: `docs/strategy-social-as-core.md`; team-facing version: `docs/floq-direction-brief.md`.

**Two phases — do NOT conflate them:**
- **Phase A — friend-pairing (build now, W7).** You bring your own partner. No marketplace/liquidity problem (you supply the partner), keeps the on-device-ML/privacy model intact (a pair is two known people), executable by two people without capital. Limit: reaches only people whose friends also want it — strong, not explosive.
- **Phase B — matching (CONDITIONAL, post-MVP, likely needs capital).** The app matches you with a compatible stranger (Focusmate shape). This is the version with the venture ceiling — but it's a two-sided **marketplace** (needs liquidity), it **breaks L2/L4** (matching is cross-user/server-side; some derived data must leave the device — the "no behavioral data leaves" claim must be amended to "coarse derived features for matching only"), and it likely forces **synchronous** sessions. **Not built until Phase A clears the gate.**

**Validation gate (what keeps this honest):** build Phase A; ship the W8 beta to **pairs**, not individuals. Measure **leading indicators — signal, not significance** (n is tiny): do invited partners accept? do paired users return at day 7/14 when solo users start fading? do people screenshot the session card unprompted? **Graduate** to Phase B planning only if pairs visibly out-retain solos AND invite-acceptance is meaningful; **kill** otherwise.

**The gate is directional, not proof — and its weaknesses are named on purpose:** at n≈10–15, with a deliberately *gentle* streak and an *async* (not synchronous) commitment surface, a null/weak result is **ambiguous** — it can't cleanly separate "pairing doesn't work" from "gentle-async pairing doesn't work." Two disciplines guard against rationalizing past a failed gate: (1) the **kill decision and the decider (Mohamed) are pre-committed here, in writing, before the beta starts**; (2) if the W8 read is ambiguous, the default action is **revert to solo-first for launch and retest coupling/sync later** — NOT "build Phase B anyway." Coupling strength (gentle ↔ punitive) and async-vs-sync are variables for a *larger later test*, not the MVP beta.

**Revert (one step):** if the W8 read fails (or is ambiguous), the prior W7 plan — friend-graph (M7.1), social profile sync (M7.2), friend list + leaderboard (M7.3), Friends screen (S7.1), add-friend flow (S7.2) — is restored from **git history** (last commit on `main` before the `spec/social-core-pivot` branch — `git show main:shared/spec/tasks.md` for the prior definitions; the partnership code in M7.x / S7.0 becomes an optional, demoted feature). For the App Store launch we ship **solo-first + the session card**. Nothing built in Phase A is wasted — the card, the ML, and the W4 lifecycle work are all path-agnostic. The dual-tree of superseded tasks is intentionally **not** maintained inside `tasks.md` — git is the revert source so the active spec stays unambiguous (per Mohamed 2026-05-28).

**Monetization (free the loop, charge the depth):**
- **Free, never paywalled:** solo timer, one partner, pairing/streaks, the session card. This is the growth+retention engine; paywalling it kills the loop.
- **Paid (Pro):** longitudinal "understand your brain" analytics, advanced ML insight/forecast, smarter/priority matching (Phase B), integrations (HealthKit/calendar), multiple partners. Anchor model: **Strava** (free social loop, paid analytics). **v1 pricing is deliberately modest (~$5–7/mo, Focusmate-band)** — a phone timer alone is thin data for a premium "cognitive-health" story; **premium (~$70–100/yr) is *earned* later** once richer signals (sleep/HRV via HealthKit, calendar) make the longitudinal value real. Do not charge premium on v1 data.
- **Pairing-native levers:** a partner's Pro features create upgrade pull; a discounted **pair plan** (cf. Spotify Duo) is a pricing unit only a pairs product has.
- **Higher-ARPU later:** "Floq for Teams" (employer / wellness-budget, per-seat) is the largest path — different sales motion, post-traction.
- **Frame as performance, not tool** (≈2–3× willingness-to-pay). Price is downstream of audience: students/ADHD = large, low-ARPU freemium; execs/teams = small, high-ARPU/employer-paid.
- **Do NOT:** ads (wrecks a focus brand), paywall the loop, one-time purchase.

**Supersedes:**
- **O5 (friend-graph schema)** — resolved by supersession: the graph is the **1:1 partner edge** (`partnerships/{pairId}`), simpler than the n:n friend graph.
- **The prior W7 plan** (M7.1–M7.3, S7.1–S7.2 — friends + leaderboard + async feed) — removed from `tasks.md`; retained in **git history** (pre-`spec/social-core-pivot`) for the revert path above.
- **CLAUDE.md**, **mobile/CLAUDE.md**, the **floq-firestore** skill, **session-flow.md**, and **schema.md** — updated to the partnership framing.

**Open architectural tension (face before Phase B, NOT now):** L2 (on-device, no server inference) and L4 (friends-only/private) are intact under Phase A but tension with Phase B matching (cross-user, server-side, stranger trust/safety). Resolve if/when Phase B is greenlit.

**Critical risks (the loop, applied to this decision):**
- **Activation cliff** — pairing-as-core means a partnerless user has no product. Mitigation: solo is a genuinely good on-ramp (P0), and *time-to-first-partner* is the make-or-break, not the streak.
- **Conviction bet** — unprovable pre-build; the gate is the discipline.
- **Async ≠ Focusmate's synchronous accountability** — our async thesis is less proven for accountability; Phase A tests whether async partner-visibility is enough.
- **No social/marketplace experience on the team** — Phase B (which needs it) is deferred behind the gate.
- **This decision itself risks the spec-lock malpractice** — mitigated by the bet/gate/revert framing and keeping mechanics in tasks as v1-subject-to-gate.

**Implementation:** new partnership tasks in `tasks.md` (Phase A) superseding the W7 friends/leaderboard tasks; the session card promoted to a W6 deliverable; `schema.md` adds `partnerships` / `partner_invites` (provisional, Phase-A). To keep the **revert cheap**, the root files all future work follows (`CLAUDE.md`, the `floq-firestore` skill) carry only a *lightweight pointer to this bet* — not a rewritten definition — so unwinding is deleting a pointer, not restoring prose.

**This is planning, not progress.** It reshapes W5–W8, but the immediate next action is unchanged: **close W4, then get the product in front of real users.** A written spec is not traction.

### L19 — DONE doesn't auto-promote the task; task completion is explicit

**Date locked:** 2026-05-29
**Decision:** Tapping DONE on `/focus` ends the session — writes the record, computes the focus score, recommends recovery — but **does NOT remove the task from the queue**. Task promotion (`markDone`) is an **explicit user action** that happens via the *Mark task done* affordance on the post-session summary (the best moment for the decision: post-flow, when the user has perspective) or via queue management on Home. Supersedes the original `session-flow.md` §Task promotion ("Done → promote next").

**Why (the gap this closes):** the original spec assumed DONE-on-session = DONE-on-task. That is correct only for **single-session tasks**. For any substantial task — the kind a focus app exists for — DONE silently consumed the queue: a 4-hour task with 70-min recommended sessions would be erased the first time the user tapped DONE, leaving no record of "still to do." End-early → Save was the wrong tool (skips recovery, treats the session as an interrupted attempt). The user had no clean path for "I focused well, the task isn't done yet" — which is the **normal** path for most real work.

**The recovery screen is the right surface, not `/focus` or the summary:**
- Mid-flow (on `/focus`) is the wrong moment to ask "is the task done?" — the user just punched out of focus and wants the timer to end.
- The summary is too brief — early sim testing (2026-05-29) showed the 5–8s auto-dismiss left no time for any tap; the user couldn't act before it disappeared. Putting the decision there was a UX dead end.
- The recovery screen has **minutes** of dwell (5–25 min recomputed break). The user is cooling down, has the countdown in front of them, and has both the perspective AND the time to assess whether the task is actually finished.
- The default is **task stays** — auto-route, Skip recovery, tap anything-else all preserve the task. Marking complete is a deliberate single tap on the explicit affordance.

**End-early Save / Discard never auto-promote** (unchanged, L16). So all three end paths now agree: nothing auto-`markDone`s the task; the user is the only one who decides "this task is done."

**Implementation:** PR3 (post-#120/#121). Files: `mobile/app/focus.tsx` (remove `markDone` from `onDone`), `mobile/app/recovery.tsx` (the *Mark task done* affordance — `Button variant="secondary" size="md"`, shown only when the just-finished task is still in the queue). `mobile/app/session-summary.tsx` forwards `taskId` + `taskTitle` to the recovery route. The spec changes are in `session-flow.md` §Task promotion + §Session-end summary + §Recovery screen + the flow diagram.

### L20 — Task-estimate cap on the session recommendation

**Date locked:** 2026-05-29
**Decision:** The session recommendation in `computeSessionPlan` is capped at `ceil(task.estimated_minutes × 1.5)` after the depletion mod (M4.7) and before the final 15/90 clamp. The cap lives in the **orchestration layer** (`services/session/compute.ts`), NOT inside `coldStart.ts`. The frozen formula + its constants are unchanged; the 15-min lower clamp still wins for tiny tasks.

**`TASK_ESTIMATE_BUFFER = 1.5`** — calibrated, not frozen. Revisit upward / downward with real beta data.

**Why (the gap this closes):** the cold-start formula recommends **focus capacity** (`base_focus × distraction × difficulty × time × fatigue`). It does not read `task.estimated_minutes` — the input is listed in `timer.md` but never consumed. So a 25-min easy task can produce a 72-min "Suggested stop" (math identity: `base × 1.0 × 1.0 × 0.85 × 1.0 = 0.85 × base`), leaving the user with ~50 min of overrun and no actual work to do (real sim test, 2026-05-29). Two different tasks (easy 25-min, hard 50-min) both landing on 72 min is a math identity (`0.85` appears in both `difficulty_mod` for hard and `time_match_mod` for off-bucket) — not a formula bug, but a real UX failure.

**Mechanics:**
- `task_cap = ceil(task.estimated_minutes × 1.5)`
- `capped = min(formula_focus, task_cap)`
- `final = clamp(capped, 15, 90)` — FOCUS_MIN/MAX still win at the extremes
- Recovery break recomputed from the (capped) focus via the existing `BREAK_RATIO/BREAK_MIN/BREAK_MAX` — no separate break cap needed.

**Why 1.5 (the buffer):** the planning-fallacy literature supports a 1.2–1.5 slack on self-reported estimates; LLM estimates have similar noise. Tighter (1.2) bites earlier and reads as "I have to finish in exactly the estimate," which is the wrong mental model. Looser (2.0) lets the 72-min-on-25-min case through. 1.5 splits the difference and is consistent with the other soft / calibrated constants (RECOVERY_FLOOR 0.85, DEPLETION_FLOOR 0.75).

**Why NOT inside `coldStart.ts`:** the safety rule on coldStart freezes the formula structure + constants. The cap is a separate constraint applied OUTSIDE the frozen formula at the orchestration layer — same pattern as M4.7's `depletion_mod` (L17).

**Implementation:** PR3. `mobile/services/session/compute.ts` adds `export const TASK_ESTIMATE_BUFFER = 1.5` + the cap step. The dev-mode `console.log` shows `taskCap` + `capBites` so the cap is observable. Tests cover: short task caps, long task doesn't cap, the FOCUS_MIN floor wins below 10 estimated minutes, the buffer constant doesn't silently drift.

### L21 — Skip recovery for sub-5-min DONEs

**Date locked:** 2026-05-29
**Decision:** When `actualFocusMinutes < MIN_FOCUS_FOR_RECOVERY` (= **5**), `recoveryBreakMinutes` returns **0** instead of clamping to BREAK_MIN. The session-summary screen reads 0 as "skip recovery" and routes the user straight to Home (reusing the PR4 #6 `breakMinutes <= 0` bail in `/recovery`).

**`MIN_FOCUS_FOR_RECOVERY = 5`** — calibrated, not frozen. Lives in `services/session/overrun.ts` (the orchestration layer), NOT inside `coldStart.ts`. The frozen 5/25 break clamps are unchanged.

**Why (the gap this closes):** the cold-start break formula `clamp(round(actual × 0.22), 5, 25)` was designed assuming the user actually did real focus work (`actualFocusMinutes ≥ FOCUS_MIN = 15`). Below that, the 5-min lower clamp dominates the proportional logic: a 3-min DONE earned the same 5-min mandated break as a 22-min DONE. That's a 167% break ratio for the 3-min case — break larger than the focus itself — and the recovery screen would dwell on a 5-min countdown for a user who barely worked. By the science the 5-min floor is "minimum useful cognitive recovery" — but cognitive recovery only matters if the user expended cognitive resources, which a 3-min session didn't.

**Decision matrix considered:**
- (a) Skip recovery for `actual < 5` → no break. **Chosen.**
- (b) Skip for `actual < 10` → tighter cutoff; rejected as too aggressive (10-min focus is light but legitimate).
- (c) Skip for `actual < FOCUS_MIN (15)` → matches the science floor exactly but rejected as too loud (a 12-min focus shouldn't read as "didn't count").
- (d) Make BREAK_MIN dynamic → changes the frozen formula, rejected.
- (e) Keep current behavior + add an explainer caption → kept the 5-min mandated break, which is the UX symptom we're solving.

5 min was picked because (a) it matches BREAK_MIN itself (you can't have a break shorter than the floor anyway), and (b) below 5 min of focus the user clearly aborted or did a trivial task — no real recovery needed.

**Mechanics:** `recoveryBreakMinutes(actual)` returns 0 when `actual < 5`, otherwise the L16 formula. The 0 sentinel propagates:
- `finalizeOnDone` stores it in `plan.breakMinutes` on the SQLite row (and Firestore mirror).
- `session-summary` checks `breakMinutes <= 0` and routes to `/home` instead of `/recovery`.
- `/recovery` keeps its own `breakMinutes <= 0` bail (PR4 #6) as defense in depth.
- M4.7 `recoveryMod` reads `prevBreak = 0` for the next session → returns 1.0 (no penalty), correctly: there was no break to skip because no break was recommended.

**Why NOT inside `coldStart.ts`:** the safety rule freezes the formula + constants. The threshold is a separate gate; same pattern as L17's `recovery_mod` and L20's task-estimate cap — orchestration-layer constraints applied OUTSIDE the frozen formula.

**Implementation:** PR5. `mobile/services/session/overrun.ts` adds `export const MIN_FOCUS_FOR_RECOVERY = 5` + the bail. `mobile/app/session-summary.tsx` adds the early-route-to-home on `breakMinutes <= 0`. Tests cover: 0/3/4 min → 0 break; 5/10/20 min → BREAK_MIN floor still wins; `finalizeOnDone` round-trips both branches.

### L22 — Streak follows device local time (resolves O6)

**Date locked:** 2026-05-29
**Decision:** The day-bucket for the streak (and for `countSessionsToday` / the M4.7 gap clock) is **device local time at session-end time**. No server-side time, no UTC normalization, no per-user time-zone field. Already implemented this way in `services/stats/aggregations.ts#currentStreak` (M4.4) and `services/storage/sessions.ts#countSessionsToday` (M3.3 fatigue input) — this locks the existing behavior and closes O6 by ratifying the default.

**Why (and why not the alternatives):**
- **Travel across time zones may feel odd.** A user who flies east loses a day-bucket boundary; flying west could "double-count" if a session ends both before and after the local midnight shifts. Accepted for MVP because (a) the user base in W8 beta is small and mostly stationary, and (b) the alternative — picking a "home" time zone or syncing via Firestore — adds complexity that's hard to make right and easy to make wrong (e.g. what's the right behavior for a user who actually moves to a new city?).
- **UTC** would be predictable but feel even weirder — a session at 10pm in New York might land in a different streak day than a session at 11pm because of the UTC midnight rollover. Worse UX than the current behavior.
- **A "streak grace period"** (allow a streak to survive one missed local-calendar day) is the natural post-MVP refinement if real users complain. Cheap to add later; not in MVP because it changes the semantic of "consecutive."

**Implementation:** already shipped — `aggregations.ts#currentStreak` uses `Date.setHours(0,0,0,0)` for the day bucket; `countSessionsToday` uses the same midnight construction; the M4.7 gap clock reads `Date.now()` for the current side and the stored epoch-ms `ended_at` for the prior side. No new code; this is a spec close.

**Revisit:** if beta feedback flags travel weirdness — add a one-day grace period (the cheapest fix) before considering per-user time-zone fields.

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

### O5 — Friend graph schema ✅ RESOLVED (2026-05-27, by supersession)

Superseded by **L18** (social-as-core pivot). The social graph is no longer an n:n friend graph — it's the **1:1 partner edge** (`partnerships/{pairId}`, sorted-UID doc). The original (a)/(b) options are moot. Partner-edge schema + security rules are specced in the new partnership M-task (`tasks.md`, W7 Phase A); the old friend-graph framing is retained in the superseded W7 tasks for the L18 revert path.

### O6 — Streak across time-zone change ✅ RESOLVED (2026-05-29)

Moved to Locked — see **L22**. Outcome: streak follows **device local time** (the default option). Acceptable for MVP; post-MVP "grace period" revisit only if travelers complain.

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

### O11 — Timer-model flywheel vs. L2 (zero data egress)

**Must resolve by:** Post-MVP — before any retraining pipeline or public claim that the mature model "beats the formula." The MVP resolution is chosen below, so this is non-blocking for W5.
**Raised by:** Mohamed, 2026-05-29.
**Owner:** Mohamed (ML).

**The tension:** The offline retraining pipeline (PyTorch → TFLite, M5.3+) has no real training fuel under L2. A global mature model trained on synthetic data cannot be *validated* as beating the cold-start formula without a real holdout set — which doesn't exist without egress. (A synthetic-trained net can still capture nonlinear cross-terms the linear formula can't — fatigue × time-of-day × difficulty — so it is **unvalidated**, not cosmetic; but "beats the formula" is unprovable on synthetic data alone.) Note: this is the **same L2/L4 fault line L18 already identified for Phase B stranger-matching, one layer down** and previously unlogged.

**MVP resolution (chosen — Option 3, descope):** The mature regime ships as a synthetic-trained **placeholder** (or simply falls back to warming — `regimeRouter.routeSessionPlan` already does this defensively, M5.2). The real on-device adaptation story for the MVP is the **warming blend** — L2-clean, computed on the user's own session history, zero egress, true today. The MLP is a **post-MVP upgrade**, not the current differentiator. **Lead the pitch with the warming blend** ("from session 5 the app learns your rhythm on-device, privately, in real time") — do not overclaim a learned model in copy or pitch. Under this resolution **M5.3 is a pipeline-proof task** (run synthetic training → export `floq-timer-v1.tflite` → drop in `mobile/assets/models/` → wire M5.4), not an accuracy project — its goal is proving the full PyTorch→TFLite→on-device-inference path end-to-end so the router has a real model to route to.

**Post-MVP path (Option 2 — consented opt-in telemetry):** Anonymized session vectors with an explicit user toggle flow to the pipeline → a real flywheel that improves the global model for everyone (cf. Whoop — the privacy stance becomes a *feature you offer*, not a constraint you defend). This **amends L2** to: *"behavioral data leaves the device only with explicit user consent, anonymized, for model improvement."* Pairs with L18's Phase-B amendment. Must be resolved (with the amended L2 written as a new Locked entry) before any public claim that the mature model beats the formula.

**Deferred (Option 4 — on-device per-user fine-tuning):** Keeps L2 fully intact, no flywheel needed, genuine per-user personalization. **Blocked** by `react-native-fast-tflite` being inference-only; the clean iOS path (Core ML `MLUpdateTask`) needs a custom native module or a library swap — a real lift, post-MVP at minimum. Revisit if Option 2's telemetry is rejected by users. Named here so it's a deliberate deferral, not an oversight.

---

## Decisions to revisit post-MVP (not now)

- Mid-session adaptation (post-MVP per blueprint).
- LSTM/attention forecast model (need 50+ sessions/user first).
- App Store launch timing (after 4–6 weeks TestFlight).
- Premium tier (only after 1000+ users).
- Apple Watch companion.
