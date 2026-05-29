// EWMA performance forecast (M5.1) — Model B in shared/spec/ml-regimes.md.
//
// Predicts the user's next-7-day expected focus score from their historical
// focus_score series. This is the MVP forecast: an exponential weighted moving
// average, NOT a sequence model (LSTM/attention is post-MVP per decisions.md
// L8 — EWMA is honest about uncertainty via wide bands while data is thin).
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

/** A next-7-day forecast: a flat predicted focus score with a confidence band.
 *  The band widens/narrows with session count (see lowerBand/upperBand below).
 *  Scores can be negative (focus score is un-clamped, M4.1) — so can the bands;
 *  callers must not assume non-negativity. */
export interface Forecast {
  predicted: number;
  lowerBand: number;
  upperBand: number;
}

// --- Calibrated constants (tune with real beta data; none are frozen
//     science constants — those live in services/timer) ---

/** EWMA smoothing factor. 0.3 leans on history (smoother) while still tracking
 *  recent change — the spec's starting point ("alpha=0.3 (tune in testing)").
 *  Lower = smoother/slower, higher = more reactive. */
export const FORECAST_ALPHA = 0.3;

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

/** Recency-weighted level via EWMA, processed oldest→newest:
 *  S₀ = x₀; Sᵢ = α·xᵢ + (1−α)·Sᵢ₋₁. Returns the final level — the flat
 *  next-period prediction. Caller guarantees scores.length ≥ 1. */
function ewmaLevel(scores: readonly number[], alpha: number): number {
  let level = scores[0];
  for (let i = 1; i < scores.length; i += 1) {
    level = alpha * scores[i] + (1 - alpha) * level;
  }
  return level;
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
 * Forecast the next 7 days of focus score from the full chronological
 * focus_score series (oldest first). Returns `null` while the forecast is
 * gated off (< MIN_SESSIONS_FOR_FORECAST sessions) — the Stats screen reads
 * null as the cold-regime "we're still learning your rhythm" state.
 *
 * Negative scores pass through un-clamped (M4.1 invariant); a constant series
 * yields a zero-width band; never returns NaN for a non-empty gated-in series.
 */
export function forecastNext7Days(focusScores: readonly number[]): Forecast | null {
  if (focusScores.length < MIN_SESSIONS_FOR_FORECAST) {
    return null;
  }

  const predicted = ewmaLevel(focusScores, FORECAST_ALPHA);
  const spread = sampleStd(focusScores);
  const k =
    focusScores.length >= MATURE_FORECAST_THRESHOLD ? MATURE_BAND_K : WARMING_BAND_K;
  const halfWidth = k * spread;

  return {
    predicted,
    lowerBand: predicted - halfWidth,
    upperBand: predicted + halfWidth,
  };
}
