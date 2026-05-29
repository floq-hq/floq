/**
 * Forecast section (S5.2) — the regime-gated forecast block on the Stats screen.
 * Three states, keyed off the lifetime session count via forecastUiState():
 *
 *   cold    (0–6)  → "We're still learning your rhythm" badge, no graph
 *   warming (7–13) → forecast band (wide)  + "Forecast confidence: low"
 *   mature  (14+)  → forecast band (tight) + "Forecast confidence: high"
 *
 * The band itself is the lightweight S5.2 stand-in (ForecastBand); S6.1 swaps in
 * the Victory time-series chart in the same slot. The wide-vs-tight band width
 * comes straight from the service (k=1.5 vs k=1.0 in lowerBand/upperBand).
 *
 * Owns the data reads (per "no business logic in screens"): useForecast() + the
 * session-count query the screen used to hold inline. The DEV-only override
 * (services/dev/forecastOverride) lets the /dev harness force any state without
 * logging real sessions — read only under `__DEV__`, so production never branches.
 */
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Card, Text } from '../ui';
import { useTheme } from '../../theme';
import { getAllSessionEndedAt } from '../../services/storage/sessions';
import {
  forecastNext7Days,
  MIN_SESSIONS_FOR_FORECAST,
  type Forecast,
} from '../../services/ml/forecast';
import { useForecast } from '../../services/stats/useStats';
import { useDevForecastOverride } from '../../services/dev/forecastOverride';
import { ForecastBand } from './ForecastBand';
import { FORECAST_CONFIDENCE_CAPTION, forecastUiState } from './forecastUiState';

/** A deterministic focus-score series of length `n` for the dev override —
 *  moderate, stable spread so the real forecastNext7Days() produces a visible
 *  band and the warming (k=1.5) vs mature (k=1.0) width difference shows. No
 *  Math.random (forbidden in this codebase's deterministic paths). */
function syntheticSeries(n: number): number[] {
  return Array.from({ length: n }, (_, i) => 65 + (i % 2 === 0 ? -11 : 11) + (i % 3) * 3);
}

export function ForecastSection() {
  const theme = useTheme();
  const { data: forecast } = useForecast();

  // Real lifetime session count (same query the screen held inline; same
  // ['stats'] namespace so pull-to-refresh invalidates it too).
  const { data: realCount = 0 } = useQuery({
    queryKey: ['stats', 'totalSessions'],
    queryFn: () => getAllSessionEndedAt().length,
  });

  // DEV override — always subscribed (the store is inert), but only honored
  // under __DEV__ so the branch is dead-code-eliminated from release builds.
  const override = useDevForecastOverride((s) => s.sessionsOverride);
  const devActive = __DEV__ && override != null;

  const count = devActive ? (override as number) : realCount;
  const state = forecastUiState(count);

  const shownForecast: Forecast | null = devActive
    ? forecastNext7Days(syntheticSeries(count))
    : forecast ?? null;

  return (
    <Card style={styles.card}>
      <Text variant="caption" color={theme.textMuted}>
        Forecast
      </Text>

      {state === 'cold' || shownForecast == null ? (
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
      ) : (
        <>
          <ForecastBand forecast={shownForecast} />
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
