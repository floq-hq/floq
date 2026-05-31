/**
 * Shareable session card — C1 "focus curve" (S6.0). The screenshot-worthy
 * artifact: a smooth phase curve (Struggle → Release → Flow) as the hero visual,
 * so it reads as "data about your brain" to someone who's never heard of Floq.
 *
 * HONESTY: the curve is the deterministic four-phase MODEL scaled to the actual
 * focused minutes (phaseCurveGeometry) — not a measured signal. Minutes-focused is
 * the legible hero; the focus score sits in the footer (un-clamped, M4.1 — negative
 * → danger). NO task title (privacy, L4). NO gradient (design-system) — the line is
 * colored per phase, the fill is a single flat accent tint. Both themes, tokens only.
 *
 * Pure presentational so react-native-view-shot can snapshot it (the modal owns
 * capture/share). The curve container ALWAYS renders so onLayout can measure its
 * width (the geometry needs it); the SVG draws once measured.
 */
import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { Text, Wordmark } from '../ui';
import { useTheme } from '../../theme';
import { phaseCurveGeometry } from './phaseCurveGeometry';
import { type FocusPhase } from './phaseSegments';
import type { SessionCardData } from '../../services/share/sessionInsight';

const CARD_W = 320;
const CARD_PAD = 24;
const CURVE_H = 116;
const CURVE_PAD = 6;

const PHASE_LABEL: Record<FocusPhase, string> = {
  struggle: 'Struggle',
  release: 'Release',
  flow: 'Flow',
};

export function SessionCardCurve({ data, insight }: { data: SessionCardData; insight: string }) {
  const theme = useTheme();
  const [curveW, setCurveW] = useState(0);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== curveW) setCurveW(w);
  };

  const minutes = Math.round(data.focusMinutes);
  const distractions = data.distractionCount;
  const score = Math.round(data.focusScore);
  const scoreColor = score < 0 ? theme.danger : theme.text;

  const geo =
    curveW > 0
      ? phaseCurveGeometry(data.focusMinutes, { width: curveW, height: CURVE_H, padding: CURVE_PAD })
      : null;

  return (
    <View style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text variant="caption" color={theme.textMuted} style={styles.kicker}>
          FOCUS SESSION
        </Text>
        <Wordmark height={18} />
      </View>

      <View style={styles.hero}>
        <Text variant="display" color={scoreColor} style={styles.minutes}>
          {score}
        </Text>
        <Text variant="caption" color={theme.textMuted}>
          focus score · {minutes} min · {distractions} distraction{distractions === 1 ? '' : 's'}
        </Text>
      </View>

      {/* Curve container ALWAYS renders so onLayout measures it; SVG draws once
          we have a width (geo). */}
      <View style={styles.curveBlock}>
        <View style={styles.curve} onLayout={onLayout}>
          {geo ? (
            <Svg width={curveW} height={CURVE_H}>
              <Defs>
                {/* Horizontal phase wash: clay (Struggle) → slate (Release) →
                    teal (Flow), blended across the curve at each phase's midpoint. */}
                <LinearGradient id="phaseFill" x1="0" y1="0" x2="1" y2="0">
                  {geo.fillStops.map((s, i) => (
                    <Stop
                      key={`${s.phase}-${i}`}
                      offset={s.offset}
                      stopColor={theme.phase[s.phase]}
                      stopOpacity={0.34}
                    />
                  ))}
                </LinearGradient>
                {/* Vertical fade so the wash dissolves FULLY into the card toward
                    the baseline — no hard cut line. Strong hue just under the curve,
                    100% background at the bottom. */}
                <LinearGradient id="phaseFade" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={theme.bgElevated} stopOpacity={0} />
                  <Stop offset="0.55" stopColor={theme.bgElevated} stopOpacity={0.12} />
                  <Stop offset="1" stopColor={theme.bgElevated} stopOpacity={1} />
                </LinearGradient>
              </Defs>
              {/* Phase wash, then the fade overlay (single-phase session = solid wash). */}
              {geo.fillStops.length >= 2 ? (
                <Path d={geo.fillPath} fill="url(#phaseFill)" />
              ) : (
                <Path
                  d={geo.fillPath}
                  fill={theme.phase[geo.fillStops[0]?.phase ?? 'struggle']}
                  fillOpacity={0.34}
                />
              )}
              <Path d={geo.fillPath} fill="url(#phaseFade)" />
              {/* Faint dashed phase dividers. */}
              {geo.dividers.map((x) => (
                <Line
                  key={x}
                  x1={x}
                  y1={CURVE_PAD}
                  x2={x}
                  y2={CURVE_H - CURVE_PAD}
                  stroke={theme.border}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              ))}
              {/* Per-phase colored line segments. */}
              {geo.strokeSegments.map((s) => (
                <Path
                  key={s.phase}
                  d={s.path}
                  fill="none"
                  stroke={theme.phase[s.phase]}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </Svg>
          ) : null}
        </View>
        {geo ? (
          <View style={styles.legend}>
            {geo.labels.map((l) => (
              <View key={l.phase} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: theme.phase[l.phase] }]} />
                <Text variant="tiny" color={theme.textMuted}>
                  {PHASE_LABEL[l.phase]} {l.range}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <Text variant="bodyMedium" color={theme.text} style={styles.insight}>
        {insight}
      </Text>

      <View style={styles.footer}>
        <View style={styles.measuredBy}>
          <Text variant="caption" color={theme.textMuted}>
            Measured by
          </Text>
          <Wordmark height={12} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    borderWidth: 1,
    borderRadius: 16,
    padding: CARD_PAD,
    gap: 14,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { letterSpacing: 1.5 },
  hero: { alignItems: 'flex-start', gap: 2 },
  minutes: { lineHeight: 64 },
  curveBlock: { gap: 8 },
  curve: { height: CURVE_H },
  legend: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  insight: { marginTop: 2 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 2 },
  measuredBy: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
