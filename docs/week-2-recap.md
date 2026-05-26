# Floq — Week 2 recap

**Week goal:** a user can sign up, complete onboarding, brain-dump tasks via the LLM, and have an onboarding seed persisted that the cold-start formula can read — plus the task queue formalized as a first-class, persisted entity.

**Status: ✅ complete.** All W2 issues closed (#10–#19) plus the two task-feature additions (#76, #77), 14 PRs merged to `main`. Auth → onboarding → brain-dump → persisted task queue is wired end-to-end, and `computeSessionPlan` can read the seed.

---

## What shipped

### Mohamed — ML / timer / backend

| Task | What | PR / issue |
|---|---|---|
| **M2.1** | **Warming blend formula** — `mobile/services/timer/warming.ts`. Blends cold-start with behavioral history: `sessions_done=5 → α=0.9`, `=14 → α=0` (pure behavioral). Edge cases handled (<2 matching sessions → 7-day average; empty history → cold result, never NaN). Unit-tested. | #70 / #10 |
| **M2.2** | **Onboarding persistence service** — `services/onboarding/persist.ts` + `useOnboardingStore`. MMKV (sync source of truth) + Firestore `users/{uid}/onboarding` (async cross-device). Opened the **owner-only Firestore rules**. | #71 / #11 |
| **M2.3** | **LLM task-parser** — `parseTasks()` implements the L10 free-tier chain (Gemini 2.5-flash-lite → Groq Llama → manual), zod-validated, MMKV `llmCache.{sha256}`. Resolved key-handling as **L12**. | #72 / #12 |
| **M2.4** | **Auth flow** — `services/firebase/auth.ts` (email/password + Google live; Apple + phone scaffolded), client-side `users/{uid}` skeleton write, MMKV auth persistence. Resolved as **L13**. | #73 / #13 |
| **M2.5** | **Task store + pure queue + MMKV persistence + full CRUD** — `useTaskStore`, pure `services/tasks/queue.ts` (`reorder`/`promoteNext`/`markDone`/`topTask`/`hiddenCount`), atomic `floq.tasks` blob. New task from **L14**. | #79, #81 / #76 |

### Mustafa — frontend / UI

| Task | What | PR / issue |
|---|---|---|
| **S2.0** | **Sign up / sign in screens** + Expo Router foundation (`(auth)` group, zod-validated forms). | #74 / #14 |
| **S2.1** | **Onboarding Q1–Q4** seed questions + per-step draft persistence (kill mid-flow → resume on the same Q). | #80 / #15 |
| **S2.2** | **Streak counter widget** — reads `useUserStore().currentStreak`; clean Day 0 state. | #82 / #16 |
| **S2.3** | **Home screen** — one visible task (title + est-min + difficulty pills), `+N hidden`, streak, `START SESSION`, `+` entry. | #84 / #17 |
| **S2.4** | **Brain-dump modal** + parsed-task list; failure path reuses the shared `ManualTaskForm`. | #83 / #18 |
| **S2.5** | **First-session framing card** — 4-step, gated on `has_seen_intro`, re-accessible read-only. | #85 / #19 |
| **S2.6** | **Manual task add + task management UI** — `TaskQueueSheet` (edit / swipe-delete / drag-reorder), understated manual add. New task from **L14**. | #87 / #77 |

### Shared / cross-cutting

- **Task feature formalized** (#78 → **L14**): the queue store, persistence, CRUD, and lifecycle were previously unowned. L14 made tasks a first-class entity with two co-equal creation paths (prominent brain-dump + understated manual) and split the work **M2.5 (data, Mohamed) → S2.6 (UI, Mustafa)**.
- **Owner-only Firestore rules** went live with M2.2 (superseding W1's full lockdown for the `users/{uid}` subtree).

---

## Decisions

### Locked this week
- **L12 — LLM keys: client-direct, accept beta risk.** `parseTasks()` calls providers directly; key read from an `EXPO_PUBLIC_` var (inlined into the bundle). Gemini key restricted to bundle id `com.floq.app` + the Generative Language API; **Groq has no bundle-id restriction** so its key ships unrestricted (free-tier + rotatable — accepted for beta). Proxy + App Check deferred to pre-public-launch.
- **L13 — Auth scope.** Email/password + Google **live**; Apple + phone **scaffolded** (throw `AuthNotConfiguredError`). `users/{uid}` skeleton written **client-side** (a Cloud Function `onCreate` needs the paid Blaze plan). Apple deferred until the $99 membership is active.
- **L14 — Task model.** Brain-dump + understated manual entry, full CRUD, M→S split; MMKV source of truth in W2, migrating to SQLite + owner-only Firestore mirror in W4 (M4.2). Task titles never leave the device (L4 invariant).

### Still open (by design, later weeks)
- **O2** Expo SDK pin (Mustafa) — effectively settled by L9, pending formal close · **O4** background-during-session policy (W3) · **O5** friend-graph schema (W6) · **O6** streak across time-zones (W4) · **O7** skippable break (W3) · **O8/O9** post-MVP.

---

## Notable findings & gotchas (so we don't relearn them)

- **Clean installs didn't build until expo-router's peers were declared** (#75) — expo-router's required peer deps weren't transitively installed; declaring them explicitly fixed a fresh `npm install`.
- **`EXPO_PUBLIC_` inlines secrets into the JS bundle** (L12). Gemini's key is restrictable (bundle id + API), so a stolen one is largely useless elsewhere; **Groq's is not restrictable** — it ships fully usable up to its free quota until rotated. Bounded only because both are free-tier. `floq.llmCache` cuts call volume before either provider is hit.
- **`getReactNativePersistence` is an RN-only export missing from the web types tsc resolves** (L13) — reached via a typed cast, and backed by an **MMKV adapter** to avoid pulling in `@react-native-async-storage/async-storage`.
- **Don't add the Apple Sign-In entitlement early.** Adding `ios.usesAppleSignIn` before the $99 Apple Developer membership is active can block device builds — so `expo-apple-authentication` is deliberately *not* installed yet (real impl sits in a comment block).
- **iOS native config doesn't hot-reload over Metro.** Google sign-in's `app.json` plugin / scheme / client-ID edits don't reach `Info.plist` via a plain `run:ios` — they need a **prebuild (`--clean`) + dev-client rebuild**.
- **The `floq.tasks` MMKV blob is device-global** (M2.5) — it would leak across accounts on a shared device. Account isolation is **deliberately deferred to M4.2** (the W4 SQLite + owner-only Firestore backend), not patched now.

---

## Process / conventions in force

- `main` is the integration branch; all work via **feature branch → PR → merge**. One PR = one concern.
- **Done = `typecheck` + `test` pass** before claiming a task complete.
- Spec in `shared/spec/` is the source of truth; open decisions resolved in `decisions.md` before the code that depends on them.

---

## What's next — Week 3 (preview)

- **Mohamed:** M3.1 phase state machine · M3.2 distraction logging · M3.3 session compute orchestrator (cold-start only for now) · M3.4 background-during-session policy (resolves O4).
- **Mustafa:** S3.0 start-session flow · S3.1 session screen UI (Reanimated timer) · S3.2 GOT DISTRACTED button · S3.3 DONE + session-end summary · S3.4 background-during-session UX · S3.5 background-policy setting.
