/**
 * Forecast band (S5.2) — a lightweight, dependency-free visualization of the
 * EWMA forecast: the predicted next-7-day score with its confidence band.
 *
 * THIS IS THE S5.2 STAND-IN. The polished time-series chart (solid past line +
 * dashed forecast + shaded region, via Victory Native) is S6.1 (ForecastChart.tsx)
 * and drops into the same gated slot in ForecastSection. We deliberately do NOT
 * pull in a charting lib here — S5.2 is about the regime-gated states + the
 * confidence caption, not the chart itself.
 *
 * The band is drawn against a FIXED score window (predicted ± REF_HALF) so a
 * wider band (warming, k=1.5σ) reads visibly wider than a tighter one (mature,
 * k=1.0σ) — band-relative scaling would erase exactly the wide/tight contrast
 * S5.2 needs to show. Exact lower/upper values are labelled, so the fixed window
 * stays honest. Scores can be negative (M4.1) — handled by the danger color and
 * the symmetric window.
 */
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui';
import { useTheme } from '../../theme';
import type { Forecast } from '../../services/ml/forecast';

/** Half-width, in score points, of the fixed window the band is drawn against.
 *  ~most session-to-session focus-score variability fits inside ±50. */
const REF_HALF = 50;

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

export function ForecastBand({ forecast }: { forecast: Forecast }) {
  const theme = useTheme();
  const { predicted, lowerBand, upperBand } = forecast;

  // Map a score onto [0,1] across the fixed window centered on `predicted`.
  const toFrac = (v: number) => clamp01((v - (predicted - REF_HALF)) / (2 * REF_HALF));
  const left = toFrac(lowerBand);
  const width = Math.max(toFrac(upperBand) - left, 0.01); // always a sliver

  const predictedRounded = Math.round(predicted);
  const predictedColor = predictedRounded < 0 ? theme.danger : undefined;

  return (
    <View>
      <View style={styles.predictedRow}>
        <Text variant="display" color={predictedColor}>
          {predictedRounded}
        </Text>
        <Text variant="caption" color={theme.textMuted} style={styles.predictedCaption}>
          expected focus score{'\n'}next 7 days
        </Text>
      </View>

      <View
        style={[styles.track, { backgroundColor: theme.border }]}
        accessibilityRole="image"
        accessibilityLabel={`Forecast ${predictedRounded}, confidence band ${Math.round(
          lowerBand,
        )} to ${Math.round(upperBand)}`}
      >
        <View
          style={[
            styles.band,
            {
              left: `${left * 100}%`,
              width: `${width * 100}%`,
              backgroundColor: theme.accentMuted,
            },
          ]}
        />
        <View style={[styles.marker, { backgroundColor: theme.accent }]} />
      </View>

      <View style={styles.bounds}>
        <Text variant="caption" color={theme.textMuted}>
          {Math.round(lowerBand)}
        </Text>
        <Text variant="caption" color={theme.textMuted}>
          {Math.round(upperBand)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  predictedRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12 },
  predictedCaption: { flex: 1 },
  track: {
    height: 10,
    borderRadius: 5,
    marginTop: 12,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  band: { position: 'absolute', top: 0, bottom: 0, borderRadius: 5 },
  // Predicted sits at the window center by construction, so the marker is centered.
  marker: {
    position: 'absolute',
    left: '50%',
    width: 2,
    top: -3,
    bottom: -3,
    marginLeft: -1,
  },
  bounds: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
});
