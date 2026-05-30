// Forecast graph data shaping (M6.1) — turns the M5.1 EWMA forecast into the
// point arrays Victory Native needs for S6.1's chart (Mustafa). PURE — zero
// React, zero I/O; the SQLite read that feeds it lives in the useForecastShape()
// hook (services/stats/useStats), per mobile/CLAUDE.md ("don't fetch in screens").
//
// The chart is ONE connected graph: a solid line of past focus scores that flows
// into a visually-distinct projection of the next few sessions, with a confidence
// band around the projection. The x-axis is SESSION ORDER (index), not calendar
// days — the EWMA forecast (forecast.ts) is a single flat level, so there is no
// per-day series to plot; "next 7 days" is realized as the next few *sessions*.
//
// This module re-derives NOTHING. It calls forecastNext7Days() for the regime
// gate (< MIN_SESSIONS_FOR_FORECAST → null), the EWMA level, and the band width
// (k=1.5 warming / k=1.0 mature) — so warming-wide vs mature-tight rides entirely
// on the values forecast.ts already returns, with no threshold logic duplicated
// here (mirrors how forecastUiState.ts imports the thresholds instead of hard-
// coding 7/14).

import { forecastNext7Days } from '../ml/forecast';

/** A single chart point. x = session index (past) or projected session index
 *  (forecast); y = focus score (un-clamped — can be negative, M4.1). */
export interface ForecastPoint {
  x: number;
  y: number;
}

/** The Victory-ready shape: a solid `past` line, a `forecast` projection segment,
 *  and a `confidenceBand` (render the region between lower→upper as a VictoryArea).
 *  All three share the anchor point (the last past session) so the solid line and
 *  the dashed projection connect seamlessly. */
export interface ForecastShape {
  past: ForecastPoint[];
  forecast: ForecastPoint[];
  confidenceBand: {
    upper: ForecastPoint[];
    lower: ForecastPoint[];
  };
}

/** How many sessions forward the projection extends ("next couple of sessions").
 *  Calibrated, not a frozen science constant — tune with real beta data. The
 *  forecast is a flat EWMA level, so this only sets how far the projection reaches
 *  on the x-axis, not its value. */
export const FORECAST_HORIZON_SESSIONS = 3;

/**
 * Shape the full chronological focus-score series (oldest first) into the chart
 * contract for S6.1. Returns `null` while the forecast is gated off (fewer than
 * MIN_SESSIONS_FOR_FORECAST sessions) — the Stats screen reads null as the cold-
 * regime "we're still learning your rhythm" state, same as forecastNext7Days().
 *
 * Geometry (x = session index):
 *  - `past`     — every observed score at its index 0..n-1 (the solid line).
 *  - `forecast` — anchored on the last past point (so solid → dashed is
 *                 continuous), projecting forward to the EWMA `predicted` level
 *                 over FORECAST_HORIZON_SESSIONS.
 *  - `confidenceBand` — fans out from the anchor (zero width at the known last
 *                 point) to the full EWMA band (`predicted ± k·σ`) at the
 *                 projection end, so uncertainty visibly grows forward.
 *
 * A constant series yields a zero-width band (collapses onto the forecast line);
 * negative scores pass through un-clamped; never returns NaN for a gated-in series.
 */
export function shapeForecast(focusScores: readonly number[]): ForecastShape | null {
  const fc = forecastNext7Days(focusScores);
  if (fc == null) {
    return null;
  }

  const lastX = focusScores.length - 1;
  const lastY = focusScores[lastX];
  const endX = lastX + FORECAST_HORIZON_SESSIONS;

  const anchor: ForecastPoint = { x: lastX, y: lastY };

  return {
    past: focusScores.map((y, i) => ({ x: i, y })),
    forecast: [anchor, { x: endX, y: fc.predicted }],
    confidenceBand: {
      upper: [anchor, { x: endX, y: fc.upperBand }],
      lower: [anchor, { x: endX, y: fc.lowerBand }],
    },
  };
}
