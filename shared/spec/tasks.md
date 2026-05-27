# shared/spec/tasks.md

Concrete, sequenced tasks for the 8-week MVP. Replaces the rough lists in the blueprint with actionable units that have explicit acceptance criteria and dependency markers.

## How to read this file

Each task has:

- **ID** — `M1.3` means Mohamed, Week 1, task 3. `S2.1` means Mustafa (S for the "S" in his code-color choice — see Legend), Week 2, task 1.
- **Owner** — who does it.
- **Depends on** — other task IDs that must be done first.
- **Unblocks** — other tasks that this one enables. So you can both see what's gating what.
- **Skill** — which Claude Code skill should fire when working on this. Mention the task in your prompt and the skill auto-loads.
- **Acceptance** — what "done" looks like.
- **Surface to spec** — if the task answers an open question in `decisions.md`, log it there.

## Legend

- **M** = Mohamed (ML, timer service, backend, Firestore integration)
- **S** = Mustafa (React Native frontend, UI/UX, design system)
- **B** = Both (paired work or sequential handoff)
- 🔴 **Critical path** — anything that blocks the W8 TestFlight ship if it slips.
- 🟡 **De-risk** — could be done later but earlier is safer.

---

# Week 1 — Foundations

Goal by end of week: a buildable Expo project, both team members can run it on a simulator, design tokens exist, cold-start formula has tests, **TFLite deployment path is proven on a real iPhone**.

## Mohamed — W1

### M1.1 🔴 Verify environment + Expo SDK 55 lock
**Depends on:** none
**Unblocks:** M1.2, M1.3, S1.1
**Skill:** none (setup task)
**Acceptance:**
- `cd mobile && npx expo --version` works
- `package.json` shows `"expo": "55.0.x"` pinned (no caret/tilde where possible — see `decisions.md` L9)
- `npx expo start` boots Metro without errors
- Project commits to git on a `main` branch
- Mustafa can clone, run `npm install && npx expo start` and see the same thing

### M1.2 🔴 Cold-start formula module
**Depends on:** M1.1
**Unblocks:** M2.1 (warming blend), M3.1 (session screen wiring)
**Skill:** `floq-timer`
**Spec references:** `@shared/spec/timer.md`, `@shared/spec/science.md`
**Files:**
- `mobile/services/timer/types.ts`
- `mobile/services/timer/coldStart.ts`
- `mobile/services/timer/index.ts`
- `mobile/services/timer/__tests__/coldStart.test.ts`
**Acceptance:**
- All test cases from the first Claude Code prompt pass
- Worked example: hard task, preferred time, 1st today, `base_focus=60` → focus=51, break=11
- Lower clamp: focus clamps to 15, break to 5
- Upper clamp: focus clamps to 90, break to 20
- Pure function, zero React imports
- `vitest` configured, `pnpm test` (or `npm test`) green

### M1.3 🔴 TFLite spike (front-loaded from W3)
**Depends on:** M1.1
**Unblocks:** all of M6 (TFLite v1 model deployment) — if this fails, the whole ML architecture changes
**Skill:** none yet (consider writing `floq-tflite` skill if this becomes complex)
**Why W1 not W3:** The blueprint says W3, but if SDK 55 + `react-native-fast-tflite` has any incompatibility, we need to know NOW so we can either drop to SDK 54 or fall back to server-side inference. Don't ship 5 weeks of work on an unverified path.
**Steps:**
1. Build a 5-layer dummy MLP in Python (`ml/spike/dummy_model.py`). Input shape matches the locked feature vector from `ml/CLAUDE.md`. Output: single scalar (focus minutes).
2. Export PyTorch → ONNX → TFLite via `ml/spike/export.py`. Validate parity (max abs diff < 1e-2).
3. Drop the `.tflite` file into `mobile/assets/models/spike.tflite`.
4. Install `react-native-fast-tflite` (this will require an Expo dev client — set it up).
5. Build the dev client (`eas build --profile development --platform ios`) — yes, this takes ~15 min the first time, do it once.
6. Load the model on a real iPhone. Run inference with a fake feature vector. Confirm:
   - Model loads without errors
   - Inference returns the expected shape
   - Inference runs in < 50ms on iPhone 12 or newer
**Acceptance:**
- A short demo video / GIF of the model running on Mohamed's phone, output logged to console
- `ml/spike/README.md` documents what was done and any issues hit
- If it fails: `decisions.md` gets a new entry describing the failure mode and the proposed fallback

### M1.4 🟡 Firestore project setup + schema doc
**Depends on:** M1.1
**Unblocks:** M2.2 (onboarding persistence), M7 (social sync)
**Skill:** `floq-firestore`
**Spec references:** the schema in the `floq-firestore` skill
**Acceptance:**
- Firebase project created in console (named `floq-prod`)
- iOS app added, `GoogleService-Info.plist` downloaded and added to `mobile/` (gitignored — committed to a shared 1Password / Vercel env)
- Firebase JS SDK installed in mobile/ — `npm install firebase`
- `mobile/services/firebase/init.ts` initializes the app on import
- Firestore rules deployed in test mode (full lockdown for now) — `backend/firestore.rules` exists
- `shared/spec/schema.md` written: every collection from the `floq-firestore` skill, with field types and required/optional markers

### M1.5 🟡 Resolve open decisions O1, O3
**Depends on:** none
**Unblocks:** M2.3 (LLM service), team velocity in general
**Acceptance:**
- **O1 — LLM provider:** Spike both Anthropic and OpenAI free tiers. Send 10 sample brain-dumps to each, log latency and rate-limit behavior. Pick the winner. Move from Open to Locked in `decisions.md` with the data.
- **O3 — Egypt plan:** Lock the option. Almost certainly option (b) — front-load ML/timer, Mustafa builds UI async during June–August. Update `decisions.md`.

---

## Mustafa — W1

### S1.1 🔴 Confirm dev environment + run the project
**Depends on:** M1.1 (project must exist first)
**Unblocks:** S1.2
**Skill:** none (setup)
**Acceptance:**
- Cloned the repo, ran `npm install && npx expo start`
- iOS simulator (or Expo Go on phone) shows the default "Hello, World" Expo screen
- Can hit `r` in Metro to reload, can see live edits
- Git config set, can push a branch

### S1.2 🔴 Design system foundation
**Depends on:** S1.1
**Unblocks:** all screens (S2.x, S3.x, S5.x, S7.x). **This must be done before any screen is built.**
**Skill:** none (design infrastructure — references `@shared/spec/design-system.md`)
**Spec references:** `@shared/spec/design-system.md` (the canonical source)
**Files to create:**
- `mobile/theme/tokens.ts` — both light and dark token objects from the design-system spec
- `mobile/theme/typography.ts` — type scale + helper `getTextStyle(token, theme)`
- `mobile/theme/ThemeContext.tsx` — provider + override store using MMKV
- `mobile/theme/useTheme.ts` — hook returning the active token set
- `mobile/theme/index.ts` — re-exports
**Acceptance:**
- `useTheme()` returns the right token set when device theme is light vs. dark
- Manual override works: setting `'dark'` in MMKV forces dark even on light-mode device
- No flash of wrong theme on cold start (MMKV is sync — verify by adding a `console.time` around theme read)
- `useColorScheme()` change is reflected within one render (toggle the simulator's Appearance setting and watch the screen update)

### S1.3 🔴 UI primitives
**Depends on:** S1.2
**Unblocks:** S2.x (onboarding), S3.x (session screen)
**Skill:** none (general RN)
**Files to create:**
- `mobile/components/ui/Button.tsx` — three variants: `primary` (filled accent), `secondary` (outlined), `ghost` (no border). Sizes: `lg`, `md`. Supports `disabled`, `loading`.
- `mobile/components/ui/Card.tsx` — `bgElevated` background, 8px radius, 1px `border` color border. No shadow by default; optional `elevated` prop adds the single allowed shadow from the spec.
- `mobile/components/ui/Pill.tsx` — full-rounded pill. Supports `solid` (colored background) and `subtle` (12% alpha) variants. Used for the phase indicator and difficulty tags.
- `mobile/components/ui/SegmentedControl.tsx` — for the onboarding Q2/Q3/Q4 segmented controls.
- `mobile/components/ui/Slider.tsx` — wraps `@react-native-community/slider`, themed.
- `mobile/components/ui/Text.tsx` — wraps RN Text, requires a `variant` prop matching the type scale tokens.
**Acceptance:**
- Each component renders correctly in both themes
- Each component has a tiny "kitchen sink" preview screen at `mobile/app/_dev/components.tsx` (gated to dev builds) showing all variants — useful for review later

### S1.4 🟡 App icon + splash screen
**Depends on:** S1.2
**Unblocks:** S8 (TestFlight prep)
**Skill:** none
**Acceptance:**
- Light and dark app icon variants from `@shared/spec/design-system.md` exported as PNGs at all required iOS sizes
- `app.json` configured for both `icon` and `darkIcon` (iOS 18+ supports system theme icons natively)
- Splash screen: dark off-black bg, teal `oq` ligature centered, no spinner, no text. Configured via `expo-splash-screen`

---

# Week 2 — Onboarding + Task input

Goal by end of week: a user can sign up, complete onboarding, brain-dump tasks via the LLM, and have an onboarding seed persisted that the cold-start formula can read.

## Mohamed — W2

### M2.1 🟡 Warming blend formula
**Depends on:** M1.2
**Unblocks:** M5.2 (regime router)
**Skill:** `floq-timer`
**Spec references:** `@shared/spec/timer.md` (warming section)
**Files:**
- `mobile/services/timer/warming.ts`
- `mobile/services/timer/__tests__/warming.test.ts`
**Acceptance:**
- `sessions_done=5` → `alpha=0.9`
- `sessions_done=14` → `alpha=0` (pure behavioral)
- Edge case: <2 matching behavioral sessions → falls back to 7-day all-sessions average
- Edge case: empty behavioral history → returns cold-formula result alone, never NaN
- Tests passing

### M2.2 🔴 Onboarding persistence service
**Depends on:** M1.4, S1.3 (needs Slider + SegmentedControl from Mustafa)
**Unblocks:** S2.x (Mustafa wires the UI to this)
**Skill:** `floq-firestore`
**Spec references:** `@shared/spec/onboarding.md`
**Files:**
- `mobile/services/onboarding/types.ts` — `OnboardingAnswers`
- `mobile/services/onboarding/persist.ts` — `saveOnboarding(answers)`, `loadOnboarding()`. Writes to MMKV (sync, source of truth) + Firestore (async, for sync across devices).
- `mobile/stores/useOnboardingStore.ts` — Zustand store that exposes the answers + a setter
**Acceptance:**
- Answers written to MMKV under `floq.onboarding` (one JSON blob, atomic write)
- Answers written to Firestore at `users/{uid}/onboarding`
- Load reads from MMKV first; falls back to Firestore if MMKV is empty (fresh install)
- Cold-start formula can be called with `useOnboardingStore.getState().answers` and get a `SessionPlan` back

### M2.3 🔴 LLM task-parser service
**Depends on:** M1.5 (O1 resolved)
**Unblocks:** S2.4 (brain-dump UI)
**Skill:** none yet (consider writing `floq-llm`)
**Files:**
- `mobile/services/llm/types.ts` — `ParsedTask = { title, estMinutes, difficulty: 1..5 }`
- `mobile/services/llm/parseTasks.ts` — main entry: `parseTasks(rawInput, useCase)`. Calls the provider, validates with zod, falls back to a manual-entry hint on failure.
- `mobile/services/llm/cache.ts` — SHA-256 hash of `(input + useCase)` → cached result. Stored in MMKV under `floq.llmCache.{hash}`.
- `mobile/services/llm/__tests__/parseTasks.test.ts` — mocks the provider, tests cache hits/misses, validates malformed JSON paths
**Acceptance:**
- Zod schema rejects malformed JSON; service returns `{ ok: false, reason: 'parse_failed' }`
- 429 rate-limit returns `{ ok: false, reason: 'rate_limited' }`
- Same input twice doesn't hit the API the second time (cache verified via a spy)
- System prompt lives in `mobile/services/llm/prompts.ts` — refined to return strict JSON, no markdown, no prose

### M2.4 🟡 Auth flow
**Depends on:** M1.4
**Unblocks:** S2.0 (welcome/signup screen — Mustafa wires UI)
**Skill:** `floq-firestore`
**Files:**
- `mobile/services/firebase/auth.ts` — `signInWithApple()`, `signInWithEmail(email, password)`, `signUp(...)`, `signOut()`, `useCurrentUser()` hook
- Apple Sign-In needs `expo-apple-authentication` — install and configure
**Acceptance:**
- New user can sign up with email and is redirected to onboarding Q1
- Existing user with onboarding complete is redirected to Home
- Sign-out clears Zustand stores + MMKV (but not the LLM cache — that's fine)
- `users/{uid}` doc is created with skeleton fields on first sign-up via a cloud function trigger (or client-side write — pick one and document in `decisions.md`)

### M2.5 🔴 Task store + queue + CRUD service
**Depends on:** M1.1 (mirrors M2.2's MMKV atomic-write pattern)
**Unblocks:** S2.4, S2.6, S3.3; extended by M4.2 (SQLite + Firestore mirror)
**Skill:** `floq-storage`
**Spec references:** `@shared/spec/task-queue.md`, `decisions.md` L14
**Files:**
- `mobile/services/tasks/types.ts` — `Task = { id, title, difficulty: 1..5, estMinutes, order, done, createdAt }`
- `mobile/services/tasks/queue.ts` — **pure** functions: `reorder`, `promoteNext`, `markDone`, `topTask`, `hiddenCount`. Zero React imports.
- `mobile/services/tasks/persist.ts` — MMKV atomic blob `floq.tasks` (source of truth until W4)
- `mobile/stores/useTaskStore.ts` — Zustand store wrapping the queue: `addTasks(ParsedTask[])`, `addTask(input)`, `updateTask(id, patch)`, `reorder`, `markDone`, `removeTask`, + `topTask` / `hiddenCount` selectors
- `mobile/services/tasks/__tests__/queue.test.ts`
**Acceptance:**
- Full CRUD: create (`addTasks` batch + `addTask` single) · read (`topTask` + `hiddenCount`) · update (edit fields, `reorder`, `markDone`) · delete (`removeTask`)
- Every op writes the MMKV blob atomically and survives an app kill (log 3 tasks, kill, reopen — still there)
- `markDone(id)` removes the current task and auto-promotes the next, per `session-flow.md` §Task promotion
- Pure `queue.ts` functions unit-tested; `pnpm test` (or `npm test`) green
- Zero React imports in `queue.ts`

---

## Mustafa — W2

### S2.0 🔴 Sign up + sign in screens
**Depends on:** S1.3, M2.4
**Unblocks:** S2.1
**Skill:** none
**Files:**
- `mobile/app/(auth)/welcome.tsx` — logo, "Sign in with Apple" button, "Continue with email" link
- `mobile/app/(auth)/sign-in.tsx` — email + password form
- `mobile/app/(auth)/sign-up.tsx` — email + password + display name form
**Acceptance:**
- Designed per spec (calm, minimal, no playful copy)
- All three forms validate (zod) and surface errors inline
- Apple Sign-In button visually correct per Apple HIG
- Successful sign-up navigates to onboarding Q1

### S2.1 🔴 Onboarding Q1–Q4 screens
**Depends on:** S1.3, M2.2
**Unblocks:** S2.5 (framing card before first session)
**Skill:** none
**Spec references:** `@shared/spec/onboarding.md`
**Files:**
- `mobile/app/(onboarding)/q1.tsx` — slider 10–90 min, default 45
- `mobile/app/(onboarding)/q2.tsx` — segmented: easy / neutral / hard
- `mobile/app/(onboarding)/q3.tsx` — segmented: morning / afternoon / evening
- `mobile/app/(onboarding)/q4.tsx` — segmented: studying / work / creative / coding
- `mobile/app/(onboarding)/ready.tsx` — "You're set. Let's go." screen with a single button to Home
- `mobile/app/(onboarding)/_layout.tsx` — Expo Router stack with progress indicator (4 dots)
**Acceptance:**
- Each answer persists to MMKV via `useOnboardingStore` immediately (no "save at end" model — if the user kills the app between Q2 and Q3, they resume on Q3)
- Back button works (without losing state)
- After Q4, the seed is finalized and the user lands on Home
- All screens render in both themes

### S2.2 🟡 Streak counter widget
**Depends on:** S1.3
**Unblocks:** S3.1 (Home screen)
**Skill:** none
**Files:**
- `mobile/components/StreakCounter.tsx`
**Acceptance:**
- Shows current streak in days, with the day count and the word "day" / "days"
- Reads from `useUserStore().currentStreak` (Mohamed will write to this in W4)
- Renders cleanly when streak is 0 (no fire emoji, no celebration — just the number and a caption "Day 0")

### S2.3 🔴 Home screen layout
**Depends on:** S1.3, S2.2
**Unblocks:** S2.4
**Skill:** none
**Files:**
- `mobile/app/(tabs)/index.tsx` — Home screen
- `mobile/app/(tabs)/_layout.tsx` — bottom tab navigator
**Acceptance:**
- Single task visible at top: title, est-minutes pill, difficulty pill
- "+N hidden" caption below if `tasks.length > 1`
- Streak counter top-right
- Large `START SESSION` primary button
- `+` button somewhere visible to open the brain-dump modal
- Empty state when no tasks: friendly nudge ("Brain-dump what you need to do today")

### S2.4 🔴 Brain-dump modal + parsed-task list
**Depends on:** S2.3, M2.3, M2.5
**Unblocks:** S2.6, S3.0 (start session needs a top task)
**Skill:** none
**Spec references:** `@shared/spec/task-queue.md`
**Files:**
- `mobile/components/BrainDumpModal.tsx`
- `mobile/components/ParsedTaskList.tsx` — drag-to-reorder list, shows task title + est-minutes + difficulty
- `mobile/components/ManualTaskForm.tsx` — text + duration picker + difficulty buttons; reused by S2.6 (first-class manual add) and as the LLM-failure path
**Acceptance:**
- Text input + (optional later) voice input
- On submit: calls `parseTasks()`, shows loading state
- On success: shows the parsed task list with drag-to-reorder
- On failure (parse / rate-limit): shows `ManualTaskForm` (the *same* component used for first-class manual add in S2.6 — not a one-off fallback)
- "Save" persists via `useTaskStore.addTasks()` (M2.5); SQLite persistence lands in W4 (M4.2)

### S2.5 🟡 First-session framing card
**Depends on:** S1.3
**Unblocks:** S3.1 (session screen)
**Skill:** none
**Spec references:** `@shared/spec/onboarding.md` (last section)
**Files:**
- `mobile/components/FirstSessionFramingCard.tsx` — 4-step modal
- Gated on `users.has_seen_intro` (mirror in MMKV)
**Acceptance:**
- Shown exactly once before the user's very first session
- 4 steps, swipeable + Next button
- Final step has "Got it, let's go" button which sets `has_seen_intro: true` and dismisses
- Re-accessible via info icon on session screen (read-only mode)
- Copy matches the spec verbatim

### S2.6 🔴 Manual task add + task management UI
**Depends on:** S2.3, S2.4 (reuses `ManualTaskForm` + `ParsedTaskList`), M2.5
**Unblocks:** —
**Skill:** none
**Spec references:** `@shared/spec/task-queue.md`, `decisions.md` L14
**Files:**
- `mobile/components/TaskQueueSheet.tsx` — full-queue management sheet
**Acceptance:**
- **Understated** manual-add entry (per L14 — a low-prominence "add manually" affordance, not a button competing with brain-dump)
- Tapping the Home **"+N hidden"** caption opens `TaskQueueSheet`: full task list with **edit** (tap → `ManualTaskForm`), **delete** (swipe), **reorder** (drag) — all calling `useTaskStore`
- Manual add and LLM brain-dump are both first-class paths into the same store
- Renders in both themes; empty state matches S4.3

---

# Week 3 — Session screen + phases + distraction logging

Goal by end of week: a user can start a session, see the phase indicator move through Struggle → Flow, tap "got distracted" to log a distraction, and tap Done to end. Distractions are persisted. The timer is computed via the cold-start formula.

## Mohamed — W3

### M3.1 🔴 Phase state machine
**Depends on:** M1.2
**Unblocks:** S3.1 (session screen)
**Skill:** `floq-timer`
**Spec references:** `@shared/spec/timer.md` (phases section)
**Files:**
- `mobile/services/timer/phases.ts`
- `mobile/services/timer/__tests__/phases.test.ts`
**Acceptance:**
- `phaseFor(0, plan)` → `'struggle'`
- `phaseFor(19*60, plan)` → `'struggle'`
- `phaseFor(21*60, plan)` → `'flow'`
- `phaseFor(plan.focusMinutes*60 + 1, plan)` → `'recovery'`
- Pure function, deterministic, no React, no timers

### M3.2 🔴 Distraction logging service
**Depends on:** M1.4, M2.2
**Unblocks:** S3.2 (distraction button wired)
**Skill:** `floq-firestore`
**Files:**
- `mobile/services/session/distraction.ts` — `logDistraction(sessionId, timestamp)` — append to local + push to Firestore on session_end (not in real time, batched)
- `mobile/stores/useActiveSessionStore.ts` — Zustand store holding active session state (start time, distractions, phase)
**Acceptance:**
- Distraction tap → increments local count immediately, optimistic update
- Distractions persist across app backgrounding (state in MMKV)
- On session end, distractions are written to Firestore in a single transaction
- Test: log 3 distractions, kill the app, reopen, distractions still there

### M3.3 🔴 Session compute orchestrator
**Depends on:** M1.2, M2.1, M2.2
**Unblocks:** S3.0 (start session button)
**Skill:** `floq-timer`
**Files:**
- `mobile/services/session/compute.ts` — `computeSessionPlan(taskId)` — pulls all live inputs (onboarding from store, history from SQLite via M4.x — for W3 just use cold-start), runs the regime router (cold only for now), returns `SessionPlan`
**Acceptance:**
- Called at session start, returns a `SessionPlan` with focus/break minutes
- Uses the cold-start formula since W3 has no behavioral history yet
- Logged to console for debugging in dev builds

### M3.4 🔴 Background-during-session policy (O4 resolution)
**Depends on:** M3.2
**Unblocks:** S3.4, S3.5
**Acceptance:**
- O4 resolved in `decisions.md` (**L15**): the policy is a **user setting**, `forgiving` (>30s, default) / `strict` (any background); option (c) call/alarm-exempt deferred (needs native CallKit)
- Settings layer: `mobile/services/settings/{types,persist}.ts` + `mobile/stores/useSettingsStore.ts` (MMKV blob `floq.settings`, default `forgiving`)
- Service-side: `mobile/services/session/backgroundPolicy.ts` — `startBackgroundPolicy({ onBackgroundDistraction })` listens to `AppState`, reads the setting, logs a distraction via the M3.2 funnel when the background time exceeds the threshold; pure `exceedsThreshold` unit-tested

---

## Mustafa — W3

### S3.0 🔴 Start session flow
**Depends on:** S2.3, M3.3
**Unblocks:** S3.1
**Skill:** none
**Acceptance:**
- Tapping `START SESSION` on Home calls `computeSessionPlan(topTaskId)`
- Loading state while compute runs (will be <100ms but still — no janky tap)
- If `has_seen_intro` is false, shows the framing card first; on dismiss continues to session
- Navigates to `/session` route

### S3.1 🔴 Session screen UI
**Depends on:** S1.3, S2.5, M3.1, M3.3
**Unblocks:** S3.2, S3.3
**Skill:** none
**Files:**
- `mobile/app/session.tsx`
- `mobile/components/session/PhaseIndicator.tsx` — the pill from `design-system.md`
- `mobile/components/session/SessionTimer.tsx` — big display number, tabular numerals
**Acceptance:**
- Phase indicator at top, color matches `theme.phase[currentPhase]`
- Large timer in center, ticking at 1Hz, **animated via Reanimated, not setState** (timer must run smoothly for 90 min)
- Task name under timer in muted text
- No pause button anywhere on the screen
- Renders correctly in both themes

### S3.2 🔴 Distraction button
**Depends on:** S1.3, S3.1, M3.2
**Unblocks:** —
**Skill:** none
**Acceptance:**
- Always visible during session, large tap target
- Tap → optimistic increment, haptic feedback (`expo-haptics` `impactAsync('medium')`)
- No confirmation dialog — one tap
- Visual feedback: button briefly flashes `danger` color background, then returns

### S3.3 🔴 Done button + session-end summary
**Depends on:** S3.1, M3.2, M2.5
**Unblocks:** M4.1 (focus score), S4.1 (stats screen)
**Skill:** none
**Files:**
- `mobile/app/session-summary.tsx`
**Acceptance:**
- Done button writes session to Firestore via Mohamed's persistence layer
- On Done: `useTaskStore.markDone(topTaskId)` removes the current task and auto-promotes the next (per `session-flow.md` §Task promotion)
- Navigates to summary screen showing: minutes focused, distractions, focus score, streak update, recovery countdown
- Auto-dismisses to recovery state after 8s OR on tap

### S3.4 🟡 Background-during-session UX
**Depends on:** M3.4
**Acceptance:**
- When background-distraction is logged, a subtle toast on return: "Backgrounded for 47s — logged a distraction."
- Wires `startBackgroundPolicy({ onBackgroundDistraction })` (M3.4) on the session screen; calls the returned `stop()` on unmount
- Tested by manually backgrounding the simulator >30s mid-session

### S3.5 🟡 Background-policy setting UI
**Depends on:** M3.4
**Skill:** none
**Spec references:** `decisions.md` L15
**Acceptance:**
- A settings control lets the user pick `forgiving` (>30s, default) vs `strict` (any background), bound to `useSettingsStore` (`setBackgroundPolicy`)
- Copy explains the trade-off in one calm line each; default reflects the persisted setting on load (`hydrate`)
- (c) call/alarm-exempt is NOT offered (deferred per L15)
- Renders in both themes

---

# Week 4 — Focus score, persistence, stats foundation

Goal by end of week: completed sessions have a focus score, sessions persist to SQLite, the Stats screen shows historical sessions (no forecast yet — gated to W7+ data).

## Mohamed — W4

### M4.1 🔴 Focus score formula
**Depends on:** M3.2, M3.3
**Skill:** `floq-timer`
**Files:**
- `mobile/services/timer/focusScore.ts`
- `mobile/services/timer/__tests__/focusScore.test.ts`
**Acceptance:**
- Test cases from `floq-timer` skill all pass (60min/0 distractions/diff3=60; 60min/1 distraction/diff3=37; etc.)
- Negative scores allowed (not clamped)

### M4.2 🔴 SQLite session + task persistence
**Depends on:** M3.3, M2.5 (migrates the task store's source of truth MMKV → SQLite)
**Skill:** `floq-storage`
**Files:**
- `mobile/models/schema.sql` — sessions, tasks, distractions tables
- `mobile/models/migrations/001_initial.ts`
- `mobile/services/storage/sessions.ts` — session CRUD layer
- `mobile/services/storage/tasks.ts` — task CRUD layer (add, update, reorder, markDone, remove)
**Acceptance:**
- Sessions written to SQLite on session end (mirrored to Firestore async)
- `getRecentSessions(n=20)` returns sorted by ended_at desc
- Tasks persisted to SQLite; `useTaskStore` swaps source-of-truth MMKV → SQLite (MMKV demotes to a fast-read cache); the M2.5 store API and its tests are unchanged
- Tasks mirrored async to Firestore `users/{uid}/tasks` (owner-only); un-provisions that section in `schema.md`
- Schema migrations run on app start; never edit schema in place — always migrate (per root CLAUDE.md)

### M4.3 🔴 Stats data layer
**Depends on:** M4.2
**Unblocks:** S4.1
**Skill:** none
**Files:**
- `mobile/services/stats/aggregations.ts` — weekly score, current streak, distraction rate, personal best
**Acceptance:**
- Computed from SQLite queries, not Firestore (fast, local)
- Memoized via TanStack Query

### M4.4 🟡 Streak computation (resolves O6)
**Depends on:** M4.2
**Acceptance:**
- `getCurrentStreak()` returns days since last gap, per the definition in `@shared/spec/session-flow.md`
- Decision on time-zone behavior logged in `decisions.md` — likely: follows device local time, revisit post-MVP

### M4.5 🔴 Session end-early (abandon) + kill/restore lifecycle
**Depends on:** M3.2 (active-session store), M4.2 (SQLite sessions)
**Unblocks:** M4.8 (end-early + restore prompt UI)
**Skill:** `floq-storage`
**Spec references:** `decisions.md` L16, `@shared/spec/session-flow.md` (edge cases / Task promotion)
**Files:**
- `mobile/models/migrations/002_session_completed.ts` — add `sessions.completed INTEGER NOT NULL DEFAULT 1`; bump `user_version` to 2
- `mobile/models/schema.sql` — update the canonical reference + version comment (never edit a shipped table in place)
- `mobile/stores/useActiveSessionStore.ts` — `abandonSession()` action; `getRestorableSession()` selector
- `mobile/services/session/restore.ts` — detect a dangling active session on launch; `resolveRestore(action: 'resume' | 'save' | 'discard')`
- `mobile/services/session/types.ts` — `CompletedSession.completed: boolean`
- `mobile/services/storage/sessions.ts` — persist `completed`; exclude `completed = 0` from the streak/aggregation queries
- `mobile/services/session/__tests__/restore.test.ts`, `mobile/services/storage/__tests__/sessions.test.ts` (extend)
**Acceptance:**
- DONE writes `completed = 1` (existing behavior + the new column)
- End-early → **Save** writes `completed = 0`, task stays in queue (no `markDone`), no recovery enforced; **Discard** writes nothing, task stays
- App killed mid-session → on relaunch `getRestorableSession()` returns the dangling session; **resume** re-enters with wall-clock-correct elapsed, **save** → `completed:0` partial, **discard** → clears the store
- End-early → **Save** computes and stores `focus_score` (M4.1) for the partial too (the `focus_score` column is NOT NULL)
- saved `completed = 0` partials are **included in both** `getCurrentStreak()` (M4.4) and the weekly-score / leaderboard aggregation (M4.3, M7.2) — saving a partial means real focus happened; only **discarded** sessions never count (per L16, supersedes session-flow.md "Completed = tapped Done")
- Migration 002 runs on first launch; existing rows backfill `completed = 1`; `schema.sql` reference updated, never edited in place
- `tsc` + `npm test` green

### M4.6 🔴 Overrun tracking + recovery-break recalculation
**Depends on:** M3.3 (compute), M4.1 (focus score), M4.2 (sessions), M4.5 (session record shape)
**Unblocks:** M4.9 (suggested-stop + overrun UI)
**Skill:** `floq-timer` (break recompute reuses the frozen formula) + `floq-storage` (migration)
**Spec references:** `decisions.md` L16, `@shared/spec/timer.md` (cold-start break ratio — FROZEN), `decisions.md` O7
**Files:**
- `mobile/models/migrations/003_session_overrun.ts` — add `sessions.overrun_minutes INTEGER NOT NULL DEFAULT 0`; bump `user_version` to 3
- `mobile/models/schema.sql` — reference update
- `mobile/services/session/overrun.ts` — **pure**: `overrunMinutes(elapsedSec, plan)` and `recoveryBreakMinutes(actualFocusMinutes)` = `clamp(round(actual × 0.22), 5, 25)`, reusing `coldStart`'s frozen ratio/clamp constants (import them; do NOT redefine — if they aren't exported, lift them to an `export const` with **no value change**, flagged per the safety rule)
- `mobile/services/session/types.ts` — `CompletedSession.overrunMinutes: number`
- `mobile/services/storage/sessions.ts` — persist `overrun_minutes` and the recomputed `break_minutes`
- the Done writer (`app/focus.tsx` consumes via the M service — S wires) — record planned vs actual vs overrun
- `mobile/services/session/__tests__/overrun.test.ts`
**Acceptance:**
- `overrunMinutes = max(0, actualFocus − plannedFocus)`; `0` at/under the suggestion
- recovery break at Done = `clamp(round(actualFocusMinutes × 0.22), 5, 25)`; a test asserts it **equals** `coldStart`'s break when `actual === planned` (guards against constant drift)
- session record stores `planned_focus_minutes`, `actual_focus_minutes`, `overrun_minutes`, and the recomputed `break_minutes`
- `phases.ts` is **untouched** — overrun is derived in the helper/UI layer, not a 5th phase (cite L16)
- Firestore mirror includes `overrun_minutes`
- pure functions, zero React; `tsc` + `npm test` green

### M4.7 🔴 Skippable recovery + gap clock + `recovery_mod` (resolves O7)
**Depends on:** M3.3 (computeSessionPlan), M4.2 (SQLite last-session `ended_at`), M4.6 (recomputed recovery break)
**Unblocks:** M4.9 (recovery-screen note + skip affordance + gap display)
**Skill:** `floq-timer`
**Spec references:** `decisions.md` L17 (+ resolved O7), `@shared/spec/timer.md` (rule #4 + the `hours_since_last` input row — being operationalized; cold-start constants stay FROZEN), `@shared/spec/session-flow.md` (rule #4)
**Files:**
- `mobile/services/session/recovery.ts` — **pure**: `recoveryMod(actualGapMin, recommendedBreakMin)` = `RECOVERY_FLOOR + (1 − RECOVERY_FLOOR) × clamp(gap/break, 0, 1)`; `export const RECOVERY_FLOOR = 0.8`
- `mobile/services/storage/sessions.ts` — `getLastSessionEndedAt()` (most-recent `ended_at`)
- `mobile/services/session/compute.ts` — read last `ended_at`, derive `actualGap` to now, apply `recoveryMod` to the **regime-router output before** `clamp(15, 90)`; `recovery_mod = 1.0` when there is no prior session inside the recovery window
- recovery hard-block removed — Start is **no longer disabled** during the break (supersede session-flow.md rule #4); `recovery_gap` is **derivable** from consecutive `ended_at`/`started_at` (no new column for MVP)
- `mobile/services/session/__tests__/recovery.test.ts`
**Acceptance:**
- `recoveryMod(gap ≥ break)` === `1.0`; `recoveryMod(0, break)` === `0.8`; monotonic between; pure, zero React
- `computeSessionPlan` applies `recovery_mod` to the router output **before** `clamp(15, 90)`; first-session-of-day / no recent prior → `1.0`; `coldStart.ts` constants untouched
- Start is **NOT** blocked during recovery (skippable); the prior session's earned focus score is unchanged
- combined `fatigue_mod × recovery_mod` validated not to push the recommendation below the 15-min clamp pathologically (calibration check logged in dev)
- `timer.md` rule #4 + `hours_since_last` row, and `session-flow.md` rule #4, updated to match L17 (under owner review)
- `tsc` + `npm test` green

### M4.8 🔴 Session-end UI: end-early affordance + Save/Discard + restore prompt
**Owner:** Mohamed — *taking the UI for these features himself (deviation from the usual M→S split, per L16)*
**Depends on:** M4.5
**Unblocks:** —
**Skill:** none (RN / Expo Router screens)
**Spec references:** `decisions.md` L16, `@shared/spec/session-flow.md`
**Files:**
- `mobile/app/focus.tsx` — add an understated "End early / I stopped" control alongside DONE (must read clearly as *not* DONE — per L16 it's a termination, not a pause)
- `mobile/components/session/EndEarlySheet.tsx` — the *Save progress* / *Discard* prompt
- `mobile/components/session/RestoreSessionPrompt.tsx` — the *Resume / Save / Discard* prompt on relaunch
- `mobile/app/index.tsx` (or a launch hook) — show the restore prompt when `getRestorableSession()` (M4.5) is non-null, before Home
**Acceptance:**
- End-early control visible during a session, understated vs DONE; one confirm step (Save / Discard)
- **Save** → `abandonSession()` + partial write (M4.5); task stays in queue; back to Home (no recovery screen)
- **Discard** → drops the in-flight session; task stays; back to Home
- On relaunch with a dangling session, the Resume/Save/Discard prompt shows before Home; **Resume** re-enters `/focus` with wall-clock-correct elapsed
- DONE path unchanged; renders in both themes

### M4.9 🔴 Suggested-stop + overrun affordance + recovery note/skip UI
**Owner:** Mohamed — *taking the UI himself (per L16 / L17)*
**Depends on:** M4.6, M4.7
**Unblocks:** —
**Skill:** none (RN / Expo Router)
**Spec references:** `decisions.md` L16, L17
**Files:**
- `mobile/app/focus.tsx` — suggested-stop time + progress toward it; once `elapsed ≥ planned`, an explicit **overrun** state/affordance (NOT the "Recovery" pill — `phases.ts` stays untouched), reading `overrunMinutes` from M4.6
- `mobile/app/session-summary.tsx` / recovery screen — show the recomputed break + a calm one-line recovery-cost note; a **skip** affordance (Start is **not** blocked, L17); a "time since last session" / gap display
**Acceptance:**
- Suggested stop time + progress visible during a session; at/after the suggested time the overrun state shows, distinct from the post-Done Recovery phase
- Recovery screen shows the recomputed break + the one-line trade-off note; skipping is one tap; Start not disabled (L17)
- gap clock / time-since-last surfaced; renders in both themes

---

## Mustafa — W4

### S4.1 🔴 Stats screen UI (historical only)
**Depends on:** S1.3, M4.3
**Unblocks:** S6.1 (forecast graph)
**Skill:** none
**Files:**
- `mobile/app/(tabs)/stats.tsx`
- `mobile/components/stats/HeroScore.tsx` — large weekly focus score
- `mobile/components/stats/SessionList.tsx` — recent sessions list
- `mobile/components/stats/SummaryCards.tsx` — personal best, streak, distraction rate
**Acceptance:**
- Hero number is the weekly focus score
- Forecast section shows the **"We're still learning your rhythm"** badge (regime-gated, cold regime)
- Renders cleanly with 0 sessions, 1 session, 10 sessions
- Both themes

### S4.2 🔴 Local notifications
**Depends on:** —
**Skill:** none
**Files:**
- `mobile/services/notifications/index.ts`
**Acceptance:**
- `expo-notifications` configured
- Break reminder scheduled at session end ("Recovery's almost up")
- Optional: session-start reminder at preferred time-of-day (Q3 from onboarding)
- Requests permission gracefully (only on first scheduled notification, not on app open)

### S4.3 🟡 Empty / error states across the app
**Depends on:** S2.x, S3.x, S4.1
**Skill:** none
**Acceptance:**
- No tasks → friendly nudge
- Offline → cached data visible + sync indicator
- LLM failure → manual entry form
- No friends yet → leaderboard empty state with "add a friend" CTA
- Cold regime → "learning your rhythm" badge on stats

---

# Week 5 — Forecast (EWMA) + TFLite v1 model

Goal by end of week: EWMA forecast service is wired (gated to sessions 7+), TFLite model v1 is trained on synthetic + early real data and deployed. Regime router is functional.

## Mohamed — W5

### M5.1 🔴 EWMA forecast service
**Depends on:** M4.2
**Skill:** none
**Files:**
- `mobile/services/ml/forecast.ts` — `forecastNext7Days()` returns `{ predicted, lowerBand, upperBand }`
- Pure function over historical focus scores
**Acceptance:**
- EWMA with alpha=0.3 (tune in testing)
- Returns wide bands at sessions 7–13, narrower at 14+
- Returns null/hidden indicator when sessions < 7

### M5.2 🔴 Regime router
**Depends on:** M1.2, M2.1, M5.1
**Skill:** `floq-timer`
**Files:**
- `mobile/services/ml/regimeRouter.ts`
**Acceptance:**
- Routes correctly across all three regimes based on `sessionsCompleted`
- Mature regime still falls back to warming if TFLite model file is missing (defensive)

### M5.3 🔴 TFLite model v1 training
**Depends on:** M1.3 (spike), M4.2 (real session data)
**Skill:** none
**Files:**
- `ml/training/v1.py` — training script
- `ml/MODEL_SPEC.md` — finalized spec from W1 lives here
- `ml/export/v1_export.py` — PyTorch → ONNX → TFLite
- `mobile/assets/models/floq-timer-v1.tflite` — deployed model
- `mobile/services/ml/modelVersion.ts` — exports `MODEL_VERSION = 'v1'`
**Acceptance:**
- Model trained on synthetic + any real session data accumulated by W5
- TFLite size < 500 KB
- Inference < 50ms on iPhone 12
- Parity check between PyTorch and TFLite outputs (max abs diff < 1e-2)
- Loaded successfully in dev client

### M5.4 🟡 Warming blend wired into session compute
**Depends on:** M2.1, M3.3, M5.2
**Acceptance:**
- `computeSessionPlan` now uses the regime router instead of always cold-start
- Existing cold-start tests still pass

---

## Mustafa — W5

### S5.1 🔴 Stats screen — historical complete
**Depends on:** S4.1
**Skill:** none
**Acceptance:**
- All summary cards populated from M4.3 aggregations
- "Personal best" view shows best session, longest streak, highest single score
- Polish pass — typography rhythm, vertical alignment

### S5.2 🔴 Stats screen — regime-gated UI states
**Depends on:** S5.1, M5.2
**Skill:** none
**Acceptance:**
- Cold regime: forecast section shows the badge, no graph
- Warming regime (≥7 sessions): forecast section shows graph with wide bands and caption "Forecast confidence: low"
- Mature regime (≥14 sessions): tight bands and caption "Forecast confidence: high"
- Mock-test by manually setting `sessionsCompleted` in dev tools

### S5.3 🟡 Mid-session adaptation — DEFER to post-MVP
**Per the blueprint:** mid-session adaptation is post-MVP. Do not build in W5.

---

# Week 6 — Forecast graph integration + warming polish

Goal by end of week: forecast graph is rendered, warming regime behaves correctly end-to-end, app feels stable enough to start adding social features in W7.

## Mohamed — W6

### M6.1 🔴 Forecast graph data shaping
**Depends on:** M5.1
**Unblocks:** S6.1
**Skill:** none
**Files:**
- `mobile/services/stats/forecastShape.ts` — converts EWMA output into the shape Victory Native needs (past line + dashed projection + band polygon)
**Acceptance:**
- Returns `{ past: Point[], forecast: Point[], confidenceBand: { upper: Point[], lower: Point[] } }`
- Empty / cold-regime returns `null` cleanly

### M6.2 🔴 Warming blend integration testing
**Depends on:** M5.2, M5.4
**Acceptance:**
- End-to-end test: synthetic user with 6 sessions, alpha=0.9, blend produces a recommendation within ±2 min of pure cold-start
- Same user at 13 sessions, alpha=0.1, blend mostly behavioral
- Logged in dev console for sanity checks

### M6.3 🟡 Edge-case QA round 1
**Depends on:** all of M3, M4, M5
**Acceptance:**
- First-ever session of a new user → no crash, cold formula, focus = expected
- 3-distraction session → focus score deeply negative, no crash, surfaces correctly in summary
- All-easy tasks for a week → behavioral averages skew easy, warming still works
- Post-60-day gap return → regime router doesn't crash, decay weights handled
- Bugs logged in GitHub issues with the `qa-w6` label

---

## Mustafa — W6

### S6.1 🔴 Forecast graph rendering
**Depends on:** S5.2, M6.1
**Skill:** none
**Files:**
- `mobile/components/stats/ForecastChart.tsx` — Victory Native chart
**Acceptance:**
- Past line drawn solid
- Forecast drawn dashed
- Confidence band rendered as shaded region
- Renders cleanly in both themes (Victory needs explicit color props)
- Empty / cold state hidden behind the regime gate

### S6.2 🔴 Animations + haptics pass
**Depends on:** all prior screens
**Skill:** none
**Acceptance:**
- Phase indicator color transition smooth (800ms easeInOut per spec)
- Distraction button has medium-impact haptic
- Done button has success haptic
- Tab switches animate cleanly
- Onboarding screen transitions feel calm (no spring bounces)

### S6.3 🟡 Accessibility pass
**Depends on:** all prior screens
**Skill:** none
**Acceptance:**
- VoiceOver tested: all interactive elements have accessible labels
- Dynamic Type tested: app doesn't break at the largest text size
- Contrast verified on both themes (use the macOS Color Picker or a contrast plugin)

---

# Week 7 — Social layer

Goal by end of week: friends can be added, leaderboard renders, async session feed works, social profile syncs on session end.

## Mohamed — W7

### M7.1 🔴 Friend graph schema (resolves O5)
**Depends on:** M1.4
**Skill:** `floq-firestore`
**Acceptance:**
- O5 locked in `decisions.md` — likely the bidirectional pair doc per the skill
- Firestore rules updated for friendships, friend_requests, social
- Cloud function for friend-request acceptance deployed (creates friendship doc, deletes request)

### M7.2 🔴 Social profile sync
**Depends on:** M3.3 (session writes), M7.1
**Skill:** `floq-firestore`
**Files:**
- `mobile/services/firebase/social.ts` — `updateSocialProfile()` called on session end
- Cloud function trigger on `sessions` collection write that updates `users/{uid}/social`
**Acceptance:**
- Profile shows display_name, current_streak, weekly_score, last_session info
- Task titles never written to social doc (privacy invariant)
- Friends can read social doc, nobody else can

### M7.3 🔴 Friend list + leaderboard data
**Depends on:** M7.1
**Skill:** `floq-firestore`
**Files:**
- `mobile/services/firebase/friends.ts` — `useFriendUids()`, `useFriendsSocialDocs()`, `sendFriendRequest()`, `acceptFriendRequest()`
**Acceptance:**
- Friend list loads in <500ms after sign-in
- Leaderboard query batches if friendUids > 10
- Pending requests visible inbox-style

---

## Mustafa — W7

### S7.1 🔴 Friends screen UI
**Depends on:** S1.3, M7.3
**Skill:** none
**Files:**
- `mobile/app/(tabs)/friends.tsx`
- `mobile/components/friends/Leaderboard.tsx`
- `mobile/components/friends/SessionFeed.tsx`
- `mobile/components/friends/FriendProfileSheet.tsx`
**Acceptance:**
- Leaderboard sorted by weekly_focus_score, descending
- Session feed shows latest 20 friend sessions
- Tap a row → profile sheet (score, streak only, NO task details)
- Empty state when no friends yet

### S7.2 🔴 Add friend flow
**Depends on:** S7.1, M7.3
**Skill:** none
**Files:**
- `mobile/app/add-friend.tsx`
- `mobile/components/friends/FriendRequestList.tsx`
**Acceptance:**
- Search by username/email
- Send request → recipient sees a pending request
- Accept → both users now see each other in leaderboard within seconds
- Privacy settings: "Who can find me" (anyone with email / nobody)

---

# Week 8 — Polish, QA, TestFlight ship

Goal by end of week: TestFlight build live, 10–15 beta users from lab + friends, no P0 bugs.

## Both — W8

### B8.1 🔴 Edge-case QA round 2
**Depends on:** everything
**Acceptance:**
- Run through every screen on iPhone 11 (smaller screen) and iPhone 15 Pro
- Test offline → online transitions
- Test session backgrounding through all 4 phases
- Test cold install → onboarding → first session end-to-end
- Test sign-out → sign-in on a different device (data syncs)
- Bugs filed and triaged

### B8.2 🔴 Performance pass
**Depends on:** everything
**Acceptance:**
- App cold start to interactive Home < 2s on iPhone 12
- Session timer 60fps for a full 90-min session (use Reanimated profiler)
- Bundle size < 25 MB before TFLite + < 2 MB for the model

### S8.3 🔴 EAS Build to TestFlight
**Depends on:** all of W7 done
**Skill:** none
**Acceptance:**
- `eas build --platform ios --profile preview` succeeds
- Build uploaded to App Store Connect
- TestFlight beta group created
- 10–15 invites sent to lab + friends
- First-launch crash-free rate target: > 99%

### M8.4 🔴 Backend monitoring setup
**Depends on:** —
**Acceptance:**
- Firebase Crashlytics or Sentry installed
- Cloud function logs reviewed
- Firestore usage dashboard reviewed (still under free tier)

### B8.5 🟡 Beta feedback ingestion
**Depends on:** S8.3
**Acceptance:**
- TestFlight feedback link in app (Settings)
- Slack channel / Discord for beta testers
- Issues triaged daily for the first 5 days post-ship

---

## Cross-cutting / ongoing for both

These are not weekly tasks — they're habits.

- **Plan mode in Claude Code before any non-trivial change.** Always.
- **Reference `@shared/spec/...` files in prompts** instead of pasting or remembering.
- **Update `decisions.md` whenever an Open decision becomes Locked.**
- **Run `pnpm typecheck` and `pnpm test` before claiming any task done.**
- **Commit format:** `<type>(<scope>): <subject>`. Small commits.
- **One PR = one concern.** No drive-by refactors.

---

## Egypt gap mitigation (Mohamed, June–August)

Before Mohamed leaves, the following MUST be done (preferably by end of W4, latest W5):

- ✅ M1.2 — cold-start formula (the brain works offline)
- ✅ M1.3 — TFLite spike proven (deployment path certified)
- ✅ M2.1 — warming blend
- ✅ M3.1 — phase state machine
- ✅ M3.2 — distraction logging
- ✅ M3.3 — session compute orchestrator
- ✅ M4.1 — focus score
- ✅ M4.2 — SQLite persistence
- ✅ M5.2 — regime router

After that, Mohamed's remaining tasks (forecast service polish, TFLite model retraining, social profile sync, friend graph) can be done async with reduced focus time, or pushed to post-return.

Mustafa's work in W5–W8 (stats UI, forecast graph rendering, friends UI, polish) is mostly independent of further ML work if the services above are stable.

If Mohamed is gone for any of W5–W8, Mustafa stubs the ML services with deterministic mocks behind the same interfaces — Mohamed swaps in the real implementations on return.
