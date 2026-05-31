/**
 * Forecast section (S5.2 → S6.1) — the regime-gated forecast block on the Stats
 * screen. Keyed off the lifetime session count via forecastUiState():
 *
 *   cold    (0–6)  → "We're still learning your rhythm" badge + unlock countdown
 *   warming (7–13) → forecast chart (wide band)  + "Forecast confidence: low"
 *   mature  (14+)  → forecast chart (tight band) + "Forecast confidence: high"
 *
 * S6.1 swaps the lightweight ForecastBand stand-in for the real time-series
 * ForecastChart (solid past + dashed projection + shaded band). Wide-vs-tight band
 * width rides on the service (k=1.5 vs k=1.0 in the shaped band), not on anything
 * here.
 *
 * Three views, not two (forecastSectionView) — audit #7: the cold countdown shows
 * ONLY when truly cold; a count ≥ gate with a momentarily-null shape (loading /
 * error) gets a neutral placeholder, never a negative "-13 more sessions".
 *
 * Owns the data reads (per "no business logic in screens"): useForecastShape() +
 * the lifetime session-count query. The DEV-only override
 * (services/dev/forecastOverride) lets the /dev harness force any state without
 * logging real sessions — read only under `__DEV__`, so production never branches.
 */
import { StyleSheet } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card, Text } from '../ui';
import { useTheme } from '../../theme';
import { getAllSessionEndedAt } from '../../services/storage/sessions';
import { MIN_SESSIONS_FOR_FORECAST } from '../../services/ml/forecast';
import { shapeForecast, type ForecastShape } from '../../services/stats/forecastShape';
import { useForecastShape } from '../../services/stats/useStats';
import { useDevForecastOverride } from '../../services/dev/forecastOverride';
import { ForecastChart } from './ForecastChart';
import {
  FORECAST_CONFIDENCE_CAPTION,
  forecastSectionView,
  forecastUiState,
} from './forecastUiState';

/** A deterministic, REALISTIC focus-score series of length `n` for the dev
 *  override — a gentle upward trend with mild smooth wobble (not a sawtooth), so
 *  the preview reads like real data and the EWMA still yields a visible band whose
 *  warming (k=1.5) vs mature (k=1.0) width difference shows. Math.sin is fine —
 *  only Math.random / Date are forbidden in this codebase's deterministic paths. */
function syntheticSeries(n: number): number[] {
  return Array.from({ length: n }, (_, i) => Math.round(58 + i * 1.4 + 5 * Math.sin(i / 1.6)));
}

export function ForecastSection() {
  const theme = useTheme();
  const { data: shape } = useForecastShape();

  // Real lifetime session count (same ['stats'] namespace so pull-to-refresh
  // invalidates it too).
  const { data: realCount = 0 } = useQuery({
    queryKey: ['stats', 'totalSessions'],
    queryFn: () => getAllSessionEndedAt().length,
  });

  // DEV override — always subscribed (the store is inert), but only honored under
  // __DEV__ so the branch is dead-code-eliminated from release builds.
  const override = useDevForecastOverride((s) => s.sessionsOverride);
  const devActive = __DEV__ && override != null;

  const count = devActive ? (override as number) : realCount;
  const state = forecastUiState(count);

  // Route the dev series through shapeForecast so the chart path matches prod.
  const shownShape: ForecastShape | null = devActive
    ? shapeForecast(syntheticSeries(count))
    : shape ?? null;

  const view = forecastSectionView({ state, hasShape: shownShape != null });

  return (
    <Card style={styles.card}>
      <Text variant="caption" color={theme.textMuted}>
        Forecast
      </Text>

      {view === 'cold' ? (
        <>
          <Text variant="bodyMedium" style={styles.badge}>
            We're still learning your rhythm.
          </Text>
          <Text variant="caption" color={theme.textMuted}>
            {`${MIN_SESSIONS_FOR_FORECAST - count} more session${
              MIN_SESSIONS_FOR_FORECAST - count === 1 ? '' : 's'
            } to unlock your forecast.`}
          </Text>
        </>
      ) : view === 'placeholder' ? (
        <Text variant="caption" color={theme.textMuted} style={styles.badge}>
          Your forecast is updating…
        </Text>
      ) : (
        <>
          <ForecastChart shape={shownShape as ForecastShape} />
          <Text variant="caption" color={theme.textMuted} style={styles.confidence}>
            {FORECAST_CONFIDENCE_CAPTION[state]}
          </Text>
        </>
      )}

      {devActive && (
        <Text variant="caption" color={theme.accent} style={styles.devNote}>
          {`dev override: ${count} sessions (${state})`}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 4 },
  badge: { marginTop: 2 },
  confidence: { marginTop: 10 },
  devNote: { marginTop: 8 },
});
