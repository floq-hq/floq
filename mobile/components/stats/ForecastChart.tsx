/**
 * Forecast chart (S6.1) — the real time-series viz that replaces the S5.2
 * ForecastBand stand-in. ONE connected graph: a solid past line of focus scores
 * (with an accent fill that fades into the card toward the baseline) flowing into
 * a dashed TREND projection, with a confidence cone that widens over the horizon.
 * Hand-rolled on react-native-svg (the HeroRing pattern) — no charting lib.
 *
 * Tap (or drag) anywhere to inspect: the nearest past session highlights and a
 * small bubble shows its number + focus score.
 *
 * All geometry is the pure forecastChartGeometry() helper; this component measures
 * its width (renders null until laid out), picks tokens, draws, and handles touch.
 * Scores are un-clamped (M4.1) — a negative projection turns the forecast line +
 * anchor danger and the zero baseline shows.
 */
import { memo, useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';

import { Text } from '../ui';
import { useTheme } from '../../theme';
import type { ForecastShape } from '../../services/stats/forecastShape';
import { forecastGeometry } from './forecastChartGeometry';

const HEIGHT = 140;
const PADDING = 12;
const TOOLTIP_W = 72;

function ForecastChartBase({ shape }: { shape: ForecastShape }) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== width) setWidth(w);
  };

  const geo = useMemo(
    () => (width > 0 ? forecastGeometry(shape, { width, height: HEIGHT, padding: PADDING }) : null),
    [shape, width],
  );

  // Tap a session to inspect it; tap again to hide (toggle). Released, not on
  // press, so a tap reads cleanly.
  const onTap = (e: GestureResponderEvent) => {
    if (!geo || geo.pastDots.length === 0) return;
    const x = e.nativeEvent.locationX;
    let best = 0;
    let bestDist = Infinity;
    geo.pastDots.forEach((d, i) => {
      const dist = Math.abs(d.x - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setSelected((prev) => (prev === best ? null : best));
  };

  const predicted = shape.forecast[shape.forecast.length - 1]?.y ?? 0;
  const projectionColor = predicted < 0 ? theme.danger : theme.accent;

  const sel = geo && selected != null ? geo.pastDots[selected] : null;
  const a11y = `Forecast chart: ${shape.past.length} past sessions, projected to ${Math.round(
    predicted,
  )}. Tap to inspect a session.`;

  return (
    <View
      style={styles.root}
      onLayout={onLayout}
      onStartShouldSetResponder={() => true}
      onResponderRelease={onTap}
      accessibilityRole="image"
      accessibilityLabel={a11y}
    >
      {geo ? (
        <Svg width={width} height={HEIGHT}>
          <Defs>
            {/* Accent fill under the past line, fading FULLY to transparent at the
                baseline — no hard cut, it dissolves into the card. */}
            <LinearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={theme.accent} stopOpacity={0.26} />
              <Stop offset="0.55" stopColor={theme.accent} stopOpacity={0.08} />
              <Stop offset="1" stopColor={theme.accent} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* Faded area under the historical line. */}
          <Path d={geo.pastFillPath} fill="url(#forecastFill)" />

          {/* Confidence cone around the projection — same accent fade as the past
              fill (top → transparent at the bottom) so it matches the design. */}
          <Path d={geo.bandPath} fill="url(#forecastFill)" />

          {/* Zero baseline — only when the series crosses 0. */}
          {geo.zeroY != null ? (
            <Line
              x1={PADDING}
              y1={geo.zeroY}
              x2={width - PADDING}
              y2={geo.zeroY}
              stroke={theme.border}
              strokeWidth={1}
            />
          ) : null}

          {/* Past↔forecast divider (the "now" line), faint + dashed. */}
          <Line
            x1={geo.dividerX}
            y1={PADDING}
            x2={geo.dividerX}
            y2={HEIGHT - PADDING}
            stroke={theme.border}
            strokeWidth={1}
            strokeDasharray="3 3"
          />

          {/* Past — solid accent line, smoothed. */}
          <Path
            d={geo.pastPath}
            fill="none"
            stroke={theme.accent}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Forecast — dashed trend projection. */}
          <Path
            d={geo.forecastPath}
            fill="none"
            stroke={projectionColor}
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeLinecap="round"
          />

          {/* Anchor dot — the last observed session ("now"). */}
          <Circle cx={geo.anchor.cx} cy={geo.anchor.cy} r={3} fill={projectionColor} />

          {/* Selection marker. */}
          {sel ? (
            <>
              <Line
                x1={sel.x}
                y1={PADDING}
                x2={sel.x}
                y2={geo.baselineY}
                stroke={theme.textMuted}
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              <Circle
                cx={sel.x}
                cy={sel.y}
                r={4}
                fill={theme.accent}
                stroke={theme.bgElevated}
                strokeWidth={2}
              />
            </>
          ) : null}
        </Svg>
      ) : null}

      {/* Tiny on-graph legend explaining the two lines + the shaded range. */}
      {geo ? (
        <View style={styles.legend} pointerEvents="none">
          <View style={styles.legendItem}>
            <View style={[styles.swatchLine, { backgroundColor: theme.accent }]} />
            <Text variant="tiny" color={theme.textMuted}>
              Past
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.swatchDashed}>
              <View style={[styles.dash, { backgroundColor: theme.accent }]} />
              <View style={[styles.dash, { backgroundColor: theme.accent }]} />
            </View>
            <Text variant="tiny" color={theme.textMuted}>
              Projected
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.swatchRange, { backgroundColor: theme.accentMuted }]} />
            <Text variant="tiny" color={theme.textMuted}>
              Likely range
            </Text>
          </View>
        </View>
      ) : null}

      {/* Inspect bubble — clamped to stay on-screen. */}
      {sel ? (
        <View
          style={[
            styles.tooltip,
            {
              backgroundColor: theme.bgElevated,
              borderColor: theme.border,
              left: Math.max(0, Math.min(sel.x - TOOLTIP_W / 2, width - TOOLTIP_W)),
              top: Math.max(0, sel.y - 40),
            },
          ]}
          pointerEvents="none"
        >
          <Text variant="tiny" color={theme.textMuted}>
            Session {sel.index + 1}
          </Text>
          <Text variant="bodyMedium" color={sel.score < 0 ? theme.danger : theme.text}>
            {Math.round(sel.score)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export const ForecastChart = memo(ForecastChartBase);

const styles = StyleSheet.create({
  root: { height: HEIGHT, marginTop: 8 },
  legend: { position: 'absolute', top: 4, left: 4, flexDirection: 'row', gap: 12, alignItems: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatchLine: { width: 14, height: 2, borderRadius: 1 },
  swatchDashed: { width: 14, flexDirection: 'row', alignItems: 'center', gap: 3 },
  dash: { width: 5, height: 2, borderRadius: 1 },
  swatchRange: { width: 12, height: 8, borderRadius: 2 },
  tooltip: {
    position: 'absolute',
    width: TOOLTIP_W,
    alignItems: 'center',
    paddingVertical: 4,
    borderWidth: 1,
    borderRadius: 8,
  },
});
