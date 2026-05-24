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

---

## Open decisions — must resolve by end of W1

### O1 — LLM provider: Anthropic vs OpenAI free tier

**Must resolve by:** End of W1
**Default if not resolved:** Spike both, pick the one with the higher free-tier rate limit. Lock here and in `mobile/services/llm/provider.ts`.
**Owner:** Mohamed
**Notes:** Whichever wins, the LLM service must be provider-agnostic at the call site (one `parseTasks(input)` function).

### O2 — Expo SDK version to pin

**Must resolve by:** End of W1
**Default if not resolved:** Latest stable that supports `react-native-fast-tflite`. Lock the exact version in `mobile/package.json` and here.
**Owner:** Mustafa

### O3 — Mohamed's Egypt plan (June–August)

**Must resolve by:** End of W1
**Options:**
  - **(a) Sprint to TestFlight before he leaves** — only viable if departure is after W8. Likely not viable.
  - **(b) Front-load architecture + ML spike, Mustafa builds UI async while Mohamed is gone, ML model v1 deferred to post-return.** This is the recommended option.
**Owner:** Both
**Notes:** Whichever option is picked, the TFLite spike in W3 is non-negotiable — without it, the entire ML deployment path is uncertain.

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
