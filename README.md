# Floq

A science-based deep-work app with a social accountability layer. AI personalizes every focus session based on your behavior; your friends keep you accountable.

> Calm operating system, not motivational productivity app.

## Why Floq

Most focus apps treat focus as binary — timer on, timer off. The neuroscience disagrees: flow has stages, the brain runs on ~90-minute ultradian cycles, and a single distraction costs roughly 23 minutes of recovery. A Pomodoro-style 25/5 timer interrupts the user right when their brain is entering the Release phase. Floq is built around these facts instead of against them.

## Three differentiators

- **Per-session adaptive timer.** Recomputed at the start of every session from live context — task difficulty, time of day, fatigue, history.
- **On-device behavioral ML.** TensorFlow Lite model adapts to the user and forecasts performance. Zero behavioral data leaves the device.
- **Async social.** Whoop-style metrics visible to friends — no real-time joining that would break focus.

## Team

- **Mohamed Hiba** — ML, timer service, backend integration. Owns `ml/`, `mobile/services/timer/`, `mobile/services/ml/`, Firestore schema.
- **Mustafa** — React Native frontend, UI/UX, design system. Owns `mobile/app/`, `mobile/components/`, `mobile/theme/`.

## Stack

React Native + Expo SDK 55 (managed + dev client) · TypeScript · Zustand · TanStack Query · MMKV + expo-sqlite · Firebase Auth + Firestore · react-native-fast-tflite · PyTorch → ONNX → TFLite · LLM free tier (Anthropic or OpenAI — see `shared/spec/decisions.md`) · Victory Native · EAS Build → TestFlight.

iOS first. Android post-MVP without rewrite.

## Repo layout

```
floq/
├── CLAUDE.md                   Project brain for Claude Code
├── mobile/                     Expo / React Native app
│   ├── CLAUDE.md               Frontend-specific rules
│   ├── app/                    Expo Router screens
│   ├── components/             Reusable UI
│   ├── services/               timer/, llm/, ml/, firebase/
│   ├── stores/                 Zustand stores
│   ├── theme/                  Design tokens + ThemeProvider
│   └── models/                 SQLite schema + TS types
├── ml/                         Python ML pipeline
│   ├── CLAUDE.md               ML-specific rules
│   ├── notebooks/
│   ├── training/
│   └── export/                 ONNX → TFLite
├── backend/                    Firestore rules + cloud functions
├── shared/spec/                Frozen product spec (single source of truth)
│   ├── timer.md                Cold-start formula, warming blend, phases
│   ├── ml-regimes.md           Cold/warming/mature router
│   ├── onboarding.md           Q1–Q4 + first-session framing
│   ├── session-flow.md         User journey, behavioral rules
│   ├── science.md              Citations for every constant
│   ├── design-system.md        Typography, color tokens, themes
│   ├── tasks.md                Week-by-week deliverables
│   └── decisions.md            Locked + open decisions
└── .claude/skills/             Project-scoped Claude Code skills
    ├── floq-timer/
    └── floq-firestore/
```

## Getting started

```bash
# 1. Install
git clone <repo-url> floq
cd floq/mobile
npm install

# 2. Add Firebase config
# Drop GoogleService-Info.plist into mobile/ (see your password manager)

# 3. Run
npx expo start
# press i for iOS simulator
```

For TFLite work, you'll need a dev client build:

```bash
cd mobile
eas build --profile development --platform ios
```

## Working with Claude Code

Every workflow goes through Claude Code. The repo is set up to make that productive:

- **Root `CLAUDE.md`** loads on every session — project conventions, safety rules, the stack.
- **`mobile/CLAUDE.md`** and **`ml/CLAUDE.md`** load when you `cd` into those folders — scope-specific rules.
- **Skills under `.claude/skills/`** auto-fire when your prompt matches (e.g. saying "cold-start formula" loads `floq-timer`).
- **Specs under `shared/spec/`** are the single source of truth — reference them with `@shared/spec/timer.md` syntax. Never re-derive from memory.

Always plan-mode before non-trivial changes (Shift+Tab in Claude Code).

## Roadmap

8-week MVP to TestFlight. See `shared/spec/tasks.md` for the week-by-week breakdown.

- **W1** — Foundations, design system, cold-start formula, TFLite spike
- **W2** — Onboarding, brain-dump, task input
- **W3** — Session screen, phase indicator, distraction logging
- **W4** — Focus score, persistence, stats foundation
- **W5** — EWMA forecast, regime router, TFLite v1 model
- **W6** — Forecast graph, warming polish, animations
- **W7** — Social: friends, leaderboard, async feed
- **W8** — QA, performance, TestFlight ship

## Constraints

- Zero paid LLM costs in MVP (free-tier provider, aggressive caching, manual fallback).
- On-device ML (no server inference, ever).
- Cross-platform from day one (React Native + TFLite).
- TestFlight by end of W8.

## License

Private / proprietary. Not for distribution.
