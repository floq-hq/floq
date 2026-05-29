# Floq — CLAUDE.md

> Read this fully before doing anything. If something here conflicts with a request, surface the conflict before proceeding.

## Project

Floq is a science-based deep-work app: a per-session adaptive **focus partnership** — a 1:1 pairing made intelligent by an on-device adaptive timer (live context: task difficulty, time of day, fatigue, history) + behavioral ML. Solo is a fully-functional on-ramp.

> **Social-as-core — `shared/spec/decisions.md` L18 (locked 2026-05-27, plan committed 2026-05-28):** the social layer is the **core**, not a feature — a 1:1 focus partnership (the install + retention + moat loop), Phase A = friend-pairing (built W7), Phase B = stranger-matching (conditional, post-MVP). The W8 beta is a market read (do paired users out-retain solos?). A **one-step revert** to solo-first + the session card exists if the read fails or is ambiguous. Detail in L18 + `docs/strategy-social-as-core.md` + `docs/floq-direction-brief.md`.

Full product spec lives in `shared/spec/`. The most important specs are:

- `shared/spec/timer.md` — cold-start formula, warming blend, focus score, phases
- `shared/spec/ml-regimes.md` — three-regime router (cold / warming / mature)
- `shared/spec/onboarding.md` — Q1–Q4 seed questions
- `shared/spec/session-flow.md` — user journey, behavioral rules
- `shared/spec/task-queue.md` — the user-task feature: model, capture (brain-dump + manual), CRUD, one-visible queue, lifecycle, persistence
- `shared/spec/decisions.md` — locked decisions + open ones (read before assuming)
- `shared/spec/design-system.md` — typography, color tokens, themes, phase colors, implementation rules
- `shared/spec/tasks.md` - it have all the tasks and implementation plan


When implementing anything timer- or ML-related, load the relevant spec file first via `@shared/spec/<file>.md`. Do not re-derive the formulas from memory.

## Target

8-week MVP shipped to TestFlight (iOS first). Android is post-MVP and must not require a rewrite — every choice here assumes cross-platform.

## Team

- **Mohamed Hiba** — ML, timer service, backend integration. Owns `ml/`, `services/timer/`, `services/ml/`, Firestore schema.
- **Mustafa** — React Native frontend, UI/UX. Owns `mobile/app/`, `mobile/components/`, design system.
- Both touch Firebase integration and the shared spec.

## Tech stack — non-negotiable

| Layer | Tool |
|---|---|
| Framework | Expo SDK 55 (managed) + dev client. RN 0.83.6, React 19.2.0, New Architecture only. |
| Language | TypeScript, strict mode |
| Navigation | Expo Router, bottom tabs (Home / Session / Stats / Friends) |
| Client state | Zustand |
| Server state | TanStack Query (caches Firestore reads) |
| Local storage | MMKV for prefs, expo-sqlite for queryable session history |
| Auth | Firebase Auth (email + Apple ID) |
| Backend | Firestore |
| On-device ML | react-native-fast-tflite |
| ML training | PyTorch → ONNX → TFLite (Mohamed's pipeline) |
| Task NLP | LLM free tier (Anthropic or OpenAI — see `shared/spec/decisions.md`) |
| Animation | react-native-reanimated (timer tick must stay off JS thread) |
| Charts | Victory Native |
| Analytics | Firebase Analytics |
| Distribution | EAS Build → TestFlight |

Do not introduce alternatives without explicit approval. No Redux, no styled-components, no NativeWind unless the decision is reversed in `shared/spec/decisions.md`.

## Repo layout

```
/floq
  CLAUDE.md             ← this file
  mobile/               Expo / React Native app
    CLAUDE.md           Mustafa's frontend conventions
    app/                Expo Router screens
    components/         Reusable UI
    services/           timer/, llm/, ml/, firebase/
    stores/             Zustand stores
    models/             SQLite schema + TS types
    assets/
  ml/                   Mohamed's Python work
    CLAUDE.md           ML conventions, training, export checklist
    notebooks/
    training/
    export/             ONNX → TFLite conversion
  backend/              Firestore rules + cloud functions
  shared/
    spec/               Frozen product spec — single source of truth
    decisions.md        Locked decisions + open ones
  .claude/
    skills/             Project-scoped skills (floq-timer, floq-firestore)
```

## Conventions

- All timer logic in `mobile/services/timer/`. **Pure functions only — zero React imports.** Must be unit-testable with no RN environment.
- Cold-start formula lives in `mobile/services/timer/coldStart.ts`. The constants (60, 0.85, 0.22, 23, clamp bounds 15/90 and 5/25) come from research and are **frozen** — see Safety Rules below.
- All LLM responses must be validated with `zod` before use. If validation fails, fall back to manual entry. Never let unvalidated JSON reach the UI.
- One visible task at a time. Hidden tasks are queried on demand, not preloaded.
- Task queue is first-class and persisted: `stores/useTaskStore.ts` (Zustand) → `services/tasks/` (pure queue + MMKV) → `services/storage/tasks.ts` (SQLite, W4) → Firestore mirror. Two creation paths — LLM brain-dump and an understated manual entry — both first-class; full CRUD. See `decisions.md` L14.
- No paused sessions. App backgrounded > 30s while in a session = log one distraction (pending confirmation in `decisions.md`).
- Phase indicator is a pure state machine: `(elapsedSeconds, sessionPlan) → phase`. No timers inside it.
- The timer recomputes recommendation **at session start**, not once per day.

## Safety rules — do NOT change without explicit instruction

These are operationally risky or research-backed. Stop and ask before touching:

- `mobile/services/timer/coldStart.ts` — the formula and its constants (23-min penalty, 0.22 break ratio, 15/90 and 5/25 clamps, difficulty mod 0.85, fatigue mods, time-match mod). Each is tied to a peer-reviewed source. Surfacing changes requires citing what changed.
- `mobile/services/timer/focusScore.ts` — same reasoning.
- `mobile/services/timer/phases.ts` — phase boundaries (0–20 Struggle, ~20 Release, 20–90 Flow, 15–20 Recovery).
- `backend/firestore.rules` — security rules. Always backward-compatible.
- `mobile/services/firebase/auth.ts` — auth flow.
- Anything in `ml/` — Mohamed's domain. Mustafa, ask before editing.
- The SQLite schema in `mobile/models/` — write a migration, do not edit in place.

## Always ask before

- Adding any new npm dependency. We are deliberately minimal.
- Changing the public shape of anything in `services/` that has more than one caller.
- Changing the spec files in `shared/spec/`. The spec is frozen; if you think it's wrong, raise the conflict instead of silently changing it.
- Touching files outside the folder of the task at hand. If a feature spans 5+ files, plan first.

## Working agreements

- **Plan mode before any non-trivial change.** Shift+Tab to toggle. Especially before touching the timer service, Firestore rules, or the ML pipeline.
- **Reference files with `@path`** instead of pasting. Reduces token spend and stops you re-deriving from memory.
- **Done means:** `pnpm typecheck` passes, `pnpm test` passes, no console errors on cold boot of the Expo dev client.
- **Commit format:** `<type>(<scope>): <subject>` — types: `feat`, `fix`, `refactor`, `chore`, `ml`, `spec`. Scopes: `timer`, `session`, `onboarding`, `stats`, `partner`, `llm`, `firebase`, `ml`, `ui`.
- **One PR = one concern.** No drive-by refactors mixed with feature work.

## Things you do not know about this project (so ask)

If a task depends on a decision that's still open in `decisions.md`, stop and surface it instead of assuming.
