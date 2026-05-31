---
name: floq-stats
description: Use this skill whenever the user asks Claude to write, modify, debug, or review Floq's STATS or FORECAST logic — weekly focus score, streaks, distraction rate, personal best, the performance forecast / projection graph, confidence bands, or the Stats-screen query hooks. Triggers include "stats", "forecast", "projection", "confidence band", "Holt", "EWMA", "weekly focus score", "streak", "aggregation", "Victory", "forecast regime", or any file under mobile/services/stats/ or mobile/services/ml/forecast.ts. NOT for the timer cold-start/phase/focus-score formula — that's floq-timer (the forecast is gated SEPARATELY from the timer regime).
---

# Floq stats & forecast — implementation skill

Covers `services/stats/` (aggregations, forecast shaping, query hooks) and `services/ml/forecast.ts`. These are **pure helpers + thin TanStack hooks** — no React, no I/O in the helpers; the SQLite read lives in the hook (mobile/CLAUDE.md: don't fetch/compute in screens).

## The forecast model (decisions L8 / O11)

- The MVP forecast is **Holt's linear exponential smoothing (level + trend)** with a **damped** projection — `forecastNext7Days` + `projectDampedScore` in `services/ml/forecast.ts`. It slopes along the recent trajectory and bends/flattens over the horizon, with a confidence cone that widens by √h. It is NOT a flat EWMA and NOT a learned model.
- A **learned sequence model (ES-RNN-style encoder) is POST-MVP** — it needs cross-USER data (accrues via the W8 beta + L23 telemetry), not 7–16 points from one user. Do not build it for the MVP (`docs/forecast-encoder.md`).
- The forecast constants (smoothing α/β, damping φ, band k, `FORECAST_HORIZON_SESSIONS`) are **calibration knobs to tune with beta data — NOT frozen science constants.** The frozen constants live only in `services/timer` (see `floq-timer`). Comment knobs as such.

## Two regimes, deliberately decoupled — do NOT couple them

| Concern | Thresholds | Lives in |
|---|---|---|
| **Timer regime** (cold/warming/mature recommendation) | 5 / 14 | `services/timer` regimeRouter |
| **Forecast gate** (hidden / wide-band / tight-band) | 7 / 14 | `services/ml/forecast.ts` (`MIN_SESSIONS_FOR_FORECAST = 7`, `MATURE_FORECAST_THRESHOLD = 14`) |

The forecast module knows NOTHING about the timer regime. `forecastNext7Days` returns `null` below 7 sessions (the UI reads `null` as the cold "we're still learning your rhythm" state via `forecastSectionView`). 7–13 → wide bands (confidence low); 14+ → tight bands (confidence high). Import the thresholds; never hard-code 7/14.

## Invariants that bite

- **Focus scores are UN-CLAMPED — negative is correct and meaningful** (a bad session). `predicted`, `trend`, and the bands can all be negative. Never `Math.max(0, …)` a score anywhere in stats/forecast. (A W5 bug came from a sign mistake here.)
- **Calendar-aware date math.** Streak/week boundaries must walk calendar midnights (`prevDayMidnight ×6`), not subtract `N*DAY_MS` (a W5 bug: `weekStartMs` was 1h off across a DST boundary). DST tests force `America/New_York`.
- **Sync queryFns + null.** expo-sqlite is synchronous → stats queryFns are sync (no `await`); TanStack v5 accepts sync queryFns and `null` returns (only `undefined` is disallowed). The UI reads `data === null` as the "—" / cold state.
- **Single namespace.** All keys live under `statsKeys.all = ['stats']`. After any session save / sync / wipe, one `invalidateQueries({ queryKey: statsKeys.all })` refreshes every card. Don't add an out-of-namespace stats key.
- **`shapeForecast` re-derives NOTHING** — it calls `forecastNext7Days` for the gate/level/trend/band, then samples the damped projection across the horizon (band half-width grows √h). All three series share the anchor (last past point) so solid→dashed connects seamlessly. The x-axis is SESSION INDEX, not calendar days.
- **The chart is hand-rolled `react-native-svg`** (not Victory) — `ForecastChart` + the pure `forecastChartGeometry` + the shared `smoothPath` (Catmull-Rom). Fall back to Victory only if the hand-rolled look fails.

## Required tests (colocated __tests__/)

- Gate: `< 7` sessions → `null`; `7` → visible wide; `14` → visible tight.
- A constant series → zero trend + zero-width band (collapses onto the line); never NaN for a gated-in series.
- Negative scores/trend pass through un-clamped.
- Aggregations: DST-boundary week/streak correctness (force a TZ); empty DB → sensible zeros/null, never NaN.

## The much-larger post-MVP Stats surface

The forecast is ONE analysis. The post-MVP roadmap (`docs/stats-postmvp.md`) adds temporal/day-of-week performance, distraction + phase analytics, estimation calibration, records, trends, and an insight-narrative layer — items 1–7 are pure on-device aggregations, shippable incrementally.

## Ask before

- Coupling the forecast gate to the timer regime (they are independent by decision).
- Clamping any score to ≥ 0.
- Building a learned/neural forecaster for the MVP (post-MVP, gated on the W8 beta).
