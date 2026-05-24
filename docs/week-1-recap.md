# Floq — Week 1 recap

**Week goal:** stand up the monorepo, lock the foundational decisions, and de-risk the two scariest unknowns (the adaptive timer math and the on-device ML deployment path) — plus a design-system + Firebase foundation to build on.

**Status: ✅ complete.** All 8 W1 issues closed (#1–#8), 10 PRs merged to `main`. Both the timer brain and the TFLite deployment path are proven; Firebase is wired; the design system + app identity are in.

---

## What shipped

### Mohamed — ML / timer / backend

| Task | What | PR / issue |
|---|---|---|
| **M1.1** | Verify environment + Expo SDK 55 lock | #1 |
| **M1.2** | **Cold-start timer formula** — `mobile/services/timer/coldStart.ts`, pure functions, frozen research-backed constants. Worked example verified: hard task @ preferred time → **focus 51 / break 11 min**. 6/6 unit tests. | #61 / #2 |
| **M1.3** | **TFLite deployment spike** — PyTorch → ONNX → TFLite pipeline proven end-to-end. Parity (PyTorch vs TFLite) **4.5e-08**, `spike.tflite` ~18 KB, loads + runs on a physical **iPhone 16 Pro at ~0.13 ms** (budget 50 ms — ~380× headroom). Reproducible on Apple-Silicon arm64 (`ml/requirements.txt`). | #62 / #3 |
| **M1.4** | **Firebase / Firestore foundation** — `floq-prod` project, JS SDK, `mobile/services/firebase/init.ts`, `backend/firestore.rules` (lockdown, **deployed live**), `shared/spec/schema.md`, env wiring. | #67 / #4 |
| **M1.5** | **Resolved open decisions O1 + O3** (see Decisions below). | #68 / #5 |

### Mustafa — frontend / UI / design system

| Task | What | PR / issue |
|---|---|---|
| **S1.1** | Confirm dev environment + run the project | #6 |
| **S1.2** | Theme / design-system foundation (`mobile/theme/`) | #63 / #7 |
| **S1.3** | UI primitives (Button, Card, Pill, SegmentedControl, Slider, Text) | #64 / #8 |
| **S1.4** | App icon + splash screen | #65 |

### Shared / cross-cutting

- **Monorepo initialized** and pushed to `github.com/floq-hq/floq` (single repo; nested git flattened).
- **Full W1–W8 task breakdown** added to `shared/spec/tasks.md` and fanned out to **GitHub issues** with owner/priority/skill labels (#59).
- **App identity polish** — transparent splash logo (re-rendered from SVG; killed the white-box-on-dark issue) + app renamed `mobile` → `floq` (#66).
- **Dev-client build path established** for native Nitro modules (fast-tflite, mmkv) on a physical iPhone.

---

## Decisions

### Locked this week
- **L9 — Expo SDK 55** (stable, pinned exact). New Architecture only; SDK 56 beta reverted (won't be the canary with TFLite on the critical path).
- **L10 — LLM provider = free-tier fallback chain** (resolves O1). Provider-agnostic `parseTasks()` waterfalls **Gemini Flash → Groq → OpenRouter `:free` → manual entry**. OpenAI/Anthropic dropped (no usable permanent free tier in 2026). "Unlimited" proxies (ApiFreeLLM/Puter) rejected on privacy grounds. Scaffolded in `mobile/services/llm/provider.ts`; HTTP + zod land in M2.3.
- **L11 — Egypt plan = normal schedule** (resolves O3). No async-gap mitigation needed; weekly plan proceeds unchanged.

### Opened for later
- **O7** — skippable break / enforced-recovery override (decide end of W3).
- **O8** — revisit the 90-min focus ceiling + clamps (post-MVP).
- **O9** — optional classic (non-flow) timer mode (post-MVP; conflicts with L5).

### Still open (by design, later weeks)
- **O2** Expo SDK pin (Mustafa) · **O4** background-during-session policy (W3) · **O5** friend-graph schema (W6/M7.1) · **O6** streak across time-zones (W4).

---

## Notable findings & gotchas (so we don't relearn them)

- **On-device ML is viable with huge margin.** The whole 8-week ML plan rested on M1.3; it holds at ~0.13 ms inference. No fallback to server-side inference needed (L2 stands).
- **Apple-Silicon arm64 matters for the ML env.** PyTorch dropped Intel-mac wheels after 2.2.2 — the conda env must be native arm64 (`CONDA_SUBDIR=osx-arm64`). `onnx2tf` needs companion deps it doesn't auto-pull (tf_keras, onnx_graphsurgeon, sng4onnx, simple_onnx_processing_tools).
- **Physical-device builds:** Expo's installer crashes on the lockdown handshake (`TypeError: Cannot convert object to primitive value`) — workaround is `xcrun devicectl` to install/launch the already-built `.app`. After adding a native module, regenerate `ios/` (`rm -rf ios && npx expo prebuild`) or the Nitro HybridObject won't register.
- **Icon/splash are native build-time assets** — they don't hot-reload over Metro; they need a prebuild + rebuild, and the simulator caches the icon (uninstall first).
- **Free LLM reality (2026):** OpenAI/Anthropic are no longer meaningfully free; Gemini's free tier (~1,500 req/day) alone covers all of beta. Stacking free tiers + the `llm_cache` collection is the strategy.

---

## Process / conventions in force

- `main` is the integration branch; all work via **feature branch → PR → merge**. One PR = one concern.
- **Done = `typecheck` + `test` pass** before claiming a task complete.
- Spec in `shared/spec/` is the source of truth; open decisions get resolved in `decisions.md` before the code that depends on them.

---

## What's next — Week 2 (preview)

- **Mohamed:** M2.1 warming blend · M2.2 onboarding persistence (opens owner-only Firestore rules) · M2.3 LLM task-parser (implements the L10 chain; decide keys: client-direct vs cloud-function proxy) · M2.4 auth flow (email + Apple).
- **Mustafa:** S2.0 sign-up/sign-in · S2.1 onboarding Q1–Q4 · S2.2 streak widget · S2.3 Home screen · S2.4 brain-dump modal · S2.5 first-session framing card.
