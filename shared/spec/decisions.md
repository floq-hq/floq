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

### O4 — Background-during-session policy

**Must resolve by:** End of W3 (when session screen lands)
**Default:** App backgrounded > 30 seconds during an active session = log one distraction.
**Options:**
  - **(a) 30s threshold** (default) — forgiving for quick switches.
  - **(b) Any background = distraction** — strictest.
  - **(c) Phone calls / alarms exempted** — kinder but adds complexity (iOS gives us the reason).
**Owner:** Mustafa
**Notes:** Whatever lands, surface it in the post-session summary so the user can mentally adjust.

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

### O7 — Skippable break / enforced-recovery override

**Must resolve by:** End of W3 (when the session screen + recovery enforcement land)
**Context:** `timer.md` rule #4 says recovery is mandatory — the next session is blocked for the suggested break duration. Real-world need: a user under deadline pressure (e.g. an exam crunch) may want to skip the break.
**Options:**
  - **(a) Hard-enforced** (current spec) — next session blocked for the full break duration.
  - **(b) Skippable with friction** — a "skip break" action exists but shows a recovery-cost warning and is logged. _(recommended)_
  - **(c) Freely skippable** — one-tap skip, no friction.
**Owner:** Both (Mustafa UI, Mohamed session-flow/state)
**Notes:** Does not affect M1.2 — the cold-start formula still *outputs* a recommended break number regardless. This decision only governs whether the session screen enforces it. Raised by Mustafa 2026-05-23.

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

---

## Decisions to revisit post-MVP (not now)

- Mid-session adaptation (post-MVP per blueprint).
- LSTM/attention forecast model (need 50+ sessions/user first).
- App Store launch timing (after 4–6 weeks TestFlight).
- Premium tier (only after 1000+ users).
- Apple Watch companion.
