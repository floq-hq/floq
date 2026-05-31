// Trend-aware performance forecast (M5.1 → M6.x) — Model B in ml-regimes.md.
//
// Predicts the user's near-future expected focus score from their historical
// focus_score series using HOLT'S LINEAR exponential smoothing (level + trend):
// the prediction follows the recent trajectory (sloped), not a flat average, so
// it reads as a real forecast. This is the strong classical baseline the M4
// competition showed is hard to beat on short series — and the "ES" half of the
// eventual ES-RNN-style cross-user encoder (post-MVP, see decisions.md O11/L8 +
// docs/forecast-encoder.md). A learned sequence model needs cross-USER data
// (accrues via the W8 beta + L23 telemetry), not 7–16 points from one person.
//
// Gated SEPARATELY from the timer regime (ml-regimes.md "Performance forecast"):
//   sessions  0–6  → hidden  (forecastNext7Days returns null)
//   sessions  7–13 → visible, WIDE bands   ("Forecast confidence: low")
//   sessions 14+   → visible, TIGHT bands   ("Forecast confidence: high")
// These thresholds are the forecast model's own — distinct from the cold/
// warming/mature timer regime (5/14) in regimeRouter.ts (M5.2). Do not couple
// the two: this module knows nothing about the timer regime.
//
// PURE — zero React, zero I/O, unit-testable in plain Node. Mirrors the style
// of services/timer/warming.ts and services/stats/aggregations.ts. The SQLite
// read that feeds it lives in the useForecast() hook (services/stats/useStats),
// per mobile/CLAUDE.md ("don't fetch in screens; push it down to services").

/** A near-future forecast: the expected NEXT-session focus score (`predicted`),
 *  the per-session `trend` (the slope the graph projects forward — can be
 *  negative), and a 1-step confidence band. The band widens/narrows with session
 *  count (see lowerBand/upperBand below) and grows with horizon downstream
 *  (forecastShape). Scores can be negative (focus score is un-clamped, M4.1) — so
 *  can the trend and bands; callers must not assume non-negativity. */
export interface Forecast {
  predicted: number;
  trend: number;
  lowerBand: number;
  upperBand: number;
}

// --- Calibrated constants (tune with real beta data; none are frozen
//     science constants — those live in services/timer) ---

/** Level smoothing factor. 0.3 leans on history (smoother) while still tracking
 *  recent change — the spec's starting point ("alpha=0.3 (tune in testing)").
 *  Lower = smoother/slower, higher = more reactive. */
export const FORECAST_ALPHA = 0.3;

/** Trend smoothing factor (Holt's β). Deliberately LOW so the projected slope is
 *  stable and doesn't whip around on a single good/bad session — important on the
 *  short series this runs over. */
export const FORECAST_BETA = 0.1;

/** Trend DAMPING (Gardner's φ). A pure linear trend extrapolated forever is
 *  unrealistic and reads as a stiff regression line; damping bends the projection
 *  so each step adds φ^h·trend — the curve flattens out the further ahead it goes
 *  (and a steep recent run can't run away). This is what makes the forecast a
 *  CURVE, not a straight diagonal. */
export const FORECAST_DAMPING = 0.85;

/** Damped-trend projection `h` sessions past the last observation:
 *  level + trend·Σ_{i=1..h} φ^i. h=0 → the level; growth tapers as h rises. Pure;
 *  shared by forecastShape and its tests so the curve has one definition. */
export function projectDampedScore(fc: Forecast, h: number): number {
  const level = fc.predicted - fc.trend; // predicted is the 1-step level+trend
  let factor = 0;
  let term = 1;
  for (let i = 1; i <= h; i += 1) {
    term *= FORECAST_DAMPING;
    factor += term;
  }
  return level + fc.trend * factor;
}

/** Below this many sessions the forecast is hidden (ml-regimes.md: 0–6 hidden).
 *  Exported so the Stats UI (S5.2) gates on the same threshold instead of
 *  hard-coding 7. */
export const MIN_SESSIONS_FOR_FORECAST = 7;

/** At/above this many sessions the band tightens (ml-regimes.md: 14+ → "high"
 *  confidence). Exported for the same reason as MIN_SESSIONS_FOR_FORECAST. */
export const MATURE_FORECAST_THRESHOLD = 14;

// Band half-width = k(n) × σ, where σ is the sample standard deviation of the
// historical focus scores (a simple, honest measure of variability) and k steps
// down once enough sessions accumulate — the spec's wide→tight transition. The
// EWMA gives the band's center; σ gives its spread.
const WARMING_BAND_K = 1.5; // sessions 7–13 → wider
const MATURE_BAND_K = 1.0; // sessions 14+  → tighter

/** Holt's linear smoothing (level + trend), oldest→newest:
 *    lᵢ = α·xᵢ + (1−α)·(lᵢ₋₁ + bᵢ₋₁)
 *    bᵢ = β·(lᵢ − lᵢ₋₁) + (1−β)·bᵢ₋₁
 *  Returns the final level and trend. The next-h-step forecast is l + h·b — a
 *  sloped line, not a flat level. Caller guarantees scores.length ≥ 2 (the gate
 *  is 7). Trend seeds from the first observed step. */
function holtLinear(
  scores: readonly number[],
  alpha: number,
  beta: number,
): { level: number; trend: number } {
  let level = scores[0];
  let trend = scores[1] - scores[0];
  for (let i = 1; i < scores.length; i += 1) {
    const prevLevel = level;
    level = alpha * scores[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  return { level, trend };
}

/** Sample standard deviation (n−1 denominator — we're estimating spread, not
 *  describing a full population). Caller guarantees scores.length ≥ 2, which
 *  holds since the forecast is gated at MIN_SESSIONS_FOR_FORECAST (= 7). */
function sampleStd(scores: readonly number[]): number {
  const n = scores.length;
  const mean = scores.reduce((sum, x) => sum + x, 0) / n;
  const variance = scores.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

/**
 * Forecast near-future focus score from the full chronological focus_score
 * series (oldest first). Returns `null` while the forecast is gated off
 * (< MIN_SESSIONS_FOR_FORECAST sessions) — the Stats screen reads null as the
 * cold-regime "we're still learning your rhythm" state.
 *
 * `predicted` is the expected NEXT session (level + trend); `trend` is the
 * per-session slope the chart projects forward (forecastShape extends it over the
 * horizon + widens the band). A flat series → zero trend + zero-width band;
 * negative scores/trend pass through un-clamped (M4.1); never NaN for a gated-in
 * series.
 */
export function forecastNext7Days(focusScores: readonly number[]): Forecast | null {
  if (focusScores.length < MIN_SESSIONS_FOR_FORECAST) {
    return null;
  }

  const { level, trend } = holtLinear(focusScores, FORECAST_ALPHA, FORECAST_BETA);
  const predicted = level + trend; // one session ahead
  const spread = sampleStd(focusScores);
  const k =
    focusScores.length >= MATURE_FORECAST_THRESHOLD ? MATURE_BAND_K : WARMING_BAND_K;
  const halfWidth = k * spread;

  return {
    predicted,
    trend,
    lowerBand: predicted - halfWidth,
    upperBand: predicted + halfWidth,
  };
}
