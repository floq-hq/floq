/**
 * Phase indicator pill (S3.1) — "the single most distinctive piece of UI in
 * Floq" (design-system.md). Top-center of the session screen.
 *
 * Rules from the design system: full-pill rounded, background = active phase
 * color at 12% alpha, text = phase color at full opacity, `tiny` (11) / weight
 * 500 / uppercase / +0.5 tracking, a 6px leading dot in the text color (presence
 * marker, NOT a pulsing status light). The color shift animates over 800ms
 * easeInOut on a phase change — no flashing, no bounce.
 *
 * This is an animated cousin of the static `Pill` primitive (which can't tween
 * its color), so it builds the pill inline. Phase → a numeric lane on a shared
 * `progress` value; interpolateColor tweens between the four phase colors. The
 * label text swaps instantly (text content can't tween); only color animates.
 */
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { getTextStyle } from '../../theme/typography';
import type { Phase } from '../../services/timer';

const PHASE_LANE: Record<Phase, number> = { struggle: 0, release: 1, flow: 2, recovery: 3 };
const PHASE_LABEL: Record<Phase, string> = {
  struggle: 'STRUGGLE',
  release: 'RELEASE',
  flow: 'FLOW',
  recovery: 'RECOVERY',
};

/** Append an alpha channel to a #RRGGBB color (alpha 0–1). Matches Pill's rule. */
function withAlpha(hex: string, alpha: number): string {
  const rgb = hex.replace('#', '').slice(0, 6);
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${rgb}${a}`;
}

export function PhaseIndicator({ phase }: { phase: Phase }) {
  const theme = useTheme();

  // Lanes 0..3 → struggle/release/flow/recovery. Recomputed cheaply each render;
  // the worklets read them by closure.
  const fg = [theme.phase.struggle, theme.phase.release, theme.phase.flow, theme.phase.recovery];
  const bg = fg.map((c) => withAlpha(c, 0.12));
  const lanes = [0, 1, 2, 3];

  const progress = useSharedValue(PHASE_LANE[phase]);
  useEffect(() => {
    // Drive the 800ms easeInOut color shift when the phase changes (design-system.md).
    progress.value = withTiming(PHASE_LANE[phase], { duration: 800, easing: Easing.inOut(Easing.ease) });
  }, [phase, progress]);

  const pillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, lanes, bg),
  }));
  const inkStyle = useAnimatedStyle(() => ({
    color: interpolateColor(progress.value, lanes, fg),
  }));
  const dotStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.value, lanes, fg),
  }));

  return (
    <Animated.View
      style={[styles.pill, pillStyle]}
      accessibilityRole="text"
      accessibilityLabel={`Phase: ${PHASE_LABEL[phase].toLowerCase()}`}
    >
      <Animated.View style={[styles.dot, dotStyle]} />
      <Animated.Text style={[getTextStyle('tiny', theme), styles.label, inkStyle]}>
        {PHASE_LABEL[phase]}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { letterSpacing: 0.5 },
});
