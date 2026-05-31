# Home redesign — build brief

> Working spec for redesigning the Home screen. Hand this to a fresh chat as the
> grounding doc. Based on Mohamed's 3-state mockup (2026-05-30) and the agreed
> design principles. The current Home (`app/(tabs)/home.tsx`) is a bare task
> launcher; this turns it into a focus dashboard that surfaces the adaptive timer's
> intelligence + the user's state, with one clear action.

## Design principles (locked earlier)
- **Dashboard with one obvious action**, not a blank launcher. Answer "what should I
  do right now, and how am I doing?" — then START.
- **Surface the intelligence.** The recommendation (focus/break, regime, why) and
  the user's state (rested/recovery, time-of-day fit, today's progress) must be
  visible *before* starting — they're the product, and today they're all hidden.
- **Less text, less friction** — but each short line still carries the idea (label
  names it; one line states the value, never how-to). WHOOP-style restraint.
- Streak/momentum is a first-class element, not a corner number.

## The three states (from the mockup)

### State 3 — Queued (primary; user has a task)
- **Status line** (top, quiet): `Day 12 · 2 sessions today · 47 min focused`
- **Hero recommendation:** big `52` `min` inside a phase-colored **arc/ring**, with
  `min focus · 11 min break` beneath. This is *the* focal point.
- **Context line:** `☀ Your strong morning window. Rested.` (time-of-day fit +
  recovery state, in plain language).
- **UP NEXT card:** `Refactor the auth flow` / `Hard · ~90 min estimated` /
  `+2 queued ›` (taps to the queue).
- **Primary CTA:** `START SESSION`.

### State 2 — Returning, empty queue (has history, no task queued)
- `Welcome back.` / `Day 2 · last session 4:47 PM yesterday`
- **Yesterday recap** stat row: `47 min focused` · `2 sessions` · `1 distraction`.
- Context card: `☀ Your strong morning window. What's today?`
- CTA: `Brain-dump` + a quieter `+ Add one task`.

### State 1 — First-time, empty (no history, no task)
- `Welcome to Floq.` / "Floq tunes the timer to your brain. Add what you want to
  focus on first — your first session sets your baseline."
- Calm wave/particle visual.
- CTA: `Brain-dump tasks`.

State selection: `firstTime` = 0 lifetime sessions & empty queue → State 1;
`returning` = ≥1 lifetime session & empty queue → State 2; else (has top task) →
State 3.

## Data → service map (what each element needs)

✅ exists & exposed · 🟡 computed but **not surfaced** (needs a small service/hook) ·
🆕 new aggregation.

| Element | Source | Status |
|---|---|---|
| `52 min focus · 11 min break` | `computeSessionPlan(topTaskId)` → `SessionPlan.focusMinutes/breakMinutes` (`services/session/compute.ts`). Today it's only called at START (`useStartSession`). | 🟡 call it on Home to **preview** the plan for the top task (new `useSessionRecommendation(topTask)` hook). Pure-ish; reads stores + SQLite. |
| Ring color | phase palette / regime | derive |
| Regime (cold/warming/mature) | `SessionPlan.regime` | ✅ in plan |
| `Rested` / recovery state | `recoveryMod(gap, prevBreak)` inside `compute.ts` (`services/session/recovery.ts`); `getLastSessionEndedAt`. Not returned today. | 🟡 surface a `rested` boolean / label — either return modifiers from compute or a small `useRecoveryState()`. |
| `Your strong morning window` | time-match: `hourBucket(now)` (`compute.ts`) vs `onboarding.preferred_time`. | 🟡 derive a human label (on-window / off-window). |
| `Day 12` (streak) | `currentStreak` / `useCurrentStreak()` (`services/stats/aggregations.ts`, `useStats.ts`) | ✅ |
| `2 sessions today` | `countSessionsToday()` (`services/storage/sessions.ts`) | ✅ |
| `47 min focused` (today) | sum `actualFocusMinutes` for today | 🆕 small aggregation + hook |
| Yesterday recap (min / sessions / distractions) | aggregations over yesterday's sessions | 🆕 `yesterdayRecap()` + hook |
| `last session 4:47 PM yesterday` | `getLastSessionEndedAt()` formatted | ✅ (format) |
| UP NEXT title / `Hard` / `~90 min` / `+2 queued` | `useTaskStore` `selectTopTask` (title, difficulty, estMinutes) + `selectHiddenCount` | ✅ — but **humanize difficulty** (1–2 Easy / 3 Medium / 4–5 Hard) via a tiny helper, not "3/5". |
| First-time "sets your baseline" | cold-regime framing copy | ✅ copy |

### Services work to enable the mockup (M-side, since these are hidden signals)
1. `useSessionRecommendation(topTask)` — preview `computeSessionPlan` for the top task on Home render (focus/break/regime) without starting a session.
2. A **plan-context** surface — `rested` + time-window label. Cleanest: have `computeSessionPlan` (or a sibling) also return the human-relevant modifiers/reasons, or a small dedicated `useNowContext()` reading `getLastSessionEndedAt` + `hourBucket` + onboarding. (Decide in planning; don't bloat the frozen formula — derive in the orchestration/UI layer.)
3. `todayFocusedMinutes()` + `yesterdayRecap()` in `services/stats/aggregations.ts` (+ `useStats` hooks), same `['stats', …]` namespace.
4. `difficultyLabel(n)` helper (Easy/Medium/Hard).

### UI work (frontend)
- Rebuild `app/(tabs)/home.tsx` into the 3 states; new components: the hero ring
  (Reanimated/SVG — reuse `SuggestedStopMeter`'s arc style if it fits), status line,
  UP NEXT card, recap row, first-time visual.
- Reuse design-system primitives already built: `components/ui/` `Text`, `Button`,
  `Card`, `Pill`, `MenuRow`-style rows, theme tokens; SVG icon style from
  `FloqTabBar`/`components/ui/icons.tsx`. Both themes.

## Tab change (confirm)
Mockup shows **4 tabs: Home / Stats / Partner / More** — the **Session tab is dropped**
(it duplicated Home's START). `components/FloqTabBar.tsx` + `app/(tabs)/_layout.tsx`
currently have 5 (Home/Session/Stats/Partner/More). Removing Session is a clean win
but a real nav change — confirm before doing it.

## Constraints / notes
- Timer tick stays off the JS thread (Reanimated) — but Home's ring is **static**
  (shows the recommendation, not a live countdown), so no tick concern.
- `computeSessionPlan` is the frozen-formula orchestration layer — **read it, don't
  change it**. New "why" labels derive in the UI/helper layer (same pattern as L17/L20).
- Frontend is normally Mustafa's; the **data-surfacing half is M-side** (hidden
  signals → hooks). Natural split: M ships the hooks/aggregations, S (or M, since
  Mohamed's driving) builds the screen.
- This is **JS-only** (no native) → once build #4 is on devices it ships via
  `eas update --channel production`, no rebuild.

## Open questions for planning
1. Confirm dropping the Session tab (4 tabs).
2. Where the recovery/time-window "why" labels live (return from compute vs a
   separate `useNowContext`).
3. Ring: reuse `SuggestedStopMeter` arc vs a new static ring component.
4. Scope phasing: ship State-3 first (the daily-driver) then 2 & 1, or all together.

## Suggested build order
1. **M (services):** recommendation-preview hook, now-context (rested/window),
   today + yesterday aggregations, difficulty label — with tests. (OTA-able.)
2. **UI:** the 3-state Home consuming those hooks. (OTA-able.)
3. **Tab change** (drop Session) — small, confirm first.
