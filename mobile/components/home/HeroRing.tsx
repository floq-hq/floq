/**
 * Hero ring (Home redesign) — the focal point of the Queued state. A STATIC
 * SVG ring (not a live countdown — Home shows the recommendation, not a tick, so
 * nothing runs on the JS thread): a single teal accent arc over a faint track,
 * its length the focus share of the focus+break block. The recommended focus
 * minutes sit big in the center; the break reads beneath.
 *
 * design-system.md: single accent color (teal), flat, low-noise — so the arc is
 * `accent`, the track is `border`, and there's no gradient or shadow. The regime
 * is surfaced as a plain caption by the screen, not colored into the ring.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '../ui';
import { useTheme } from '../../theme';

type Props = {
  focusMinutes: number;
  breakMinutes: number;
};

const SIZE = 156;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const CX = SIZE / 2;
const CIRC = 2 * Math.PI * R;

function HeroRingBase({ focusMinutes, breakMinutes }: Props) {
  const theme = useTheme();
  const total = focusMinutes + breakMinutes;
  const focusFrac = total > 0 ? focusMinutes / total : 1;
  const dash = focusFrac * CIRC;

  return (
    <View style={styles.root}>
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          {/* Track — the full ring, faint. The uncovered remainder reads as break. */}
          <Circle cx={CX} cy={CX} r={R} fill="none" stroke={theme.border} strokeWidth={STROKE} />
          {/* Focus arc — accent, from the top, clockwise, rounded cap. */}
          <Circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            stroke={theme.accent}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${CIRC - dash}`}
            rotation={-90}
            originX={CX}
            originY={CX}
          />
        </Svg>
        <View style={styles.center} pointerEvents="none">
          {/* Invisible spacer label above the number balances the real one
              below, so the NUMBER (not the number+label group) sits dead-center
              in the ring. */}
          {/* S6.3 Dynamic Type: the ring is a fixed-size SVG, so the centered
              number + units are capped so large text can't overflow it (matched
              multipliers keep the ghost/real spacers balanced). */}
          <Text
            variant="tiny"
            style={[styles.unit, styles.unitGhost]}
            accessibilityElementsHidden
            maxFontSizeMultiplier={1.3}
          >
            MIN FOCUS
          </Text>
          <Text variant="display" style={styles.num} maxFontSizeMultiplier={1.3}>
            {focusMinutes}
          </Text>
          <Text variant="tiny" color={theme.textMuted} style={styles.unit} maxFontSizeMultiplier={1.3}>
            MIN FOCUS
          </Text>
        </View>
      </View>
      <Text variant="caption" color={theme.textMuted}>
        then a {breakMinutes} min break
      </Text>
    </View>
  );
}

export const HeroRing = memo(HeroRingBase);

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 12 },
  center: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  num: { lineHeight: 56, marginVertical: 4 }, // tight box + equal gaps top/bottom
  unit: { letterSpacing: 1 },
  unitGhost: { opacity: 0 },
});

