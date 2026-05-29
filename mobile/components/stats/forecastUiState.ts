// Forecast-section UI state (S5.2) — pure, zero React/RN imports so it unit-
// tests in plain Node. Maps a lifetime session count to one of the three
// forecast-section states, using the FORECAST model's own thresholds (Model B
// in ml-regimes.md), NOT the timer regime cutoffs (5/14) — see the note in
// services/ml/forecast.ts. Importing the thresholds keeps this from drifting:
//   0–6  → 'cold'    (badge, no graph)
//   7–13 → 'warming' (graph, wide band,  "Forecast confidence: low")
//   14+  → 'mature'  (graph, tight band, "Forecast confidence: high")

import {
  MATURE_FORECAST_THRESHOLD,
  MIN_SESSIONS_FOR_FORECAST,
} from '../../services/ml/forecast';

export type ForecastUiState = 'cold' | 'warming' | 'mature';

/** The confidence caption shown beneath the forecast (verbatim per S5.2
 *  acceptance). `null` for cold — that state shows the learning badge instead. */
export const FORECAST_CONFIDENCE_CAPTION: Record<ForecastUiState, string | null> = {
  cold: null,
  warming: 'Forecast confidence: low',
  mature: 'Forecast confidence: high',
};

/** Derive the forecast-section state from a lifetime session count. A non-finite
 *  or negative count defensively reads as cold (the safe "still learning" state),
 *  mirroring regimeRouter.ts's normalize-before-route guard. */
export function forecastUiState(sessionCount: number): ForecastUiState {
  if (!Number.isFinite(sessionCount) || sessionCount < MIN_SESSIONS_FOR_FORECAST) {
    return 'cold';
  }
  return sessionCount >= MATURE_FORECAST_THRESHOLD ? 'mature' : 'warming';
}
