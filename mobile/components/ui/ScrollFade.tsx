/**
 * ScrollFade — a soft gradient mask at the top or bottom edge of a scroll area
 * so content dissolves into the background as it scrolls past, instead of a hard
 * cut. Absolutely positioned over the edge; `pointerEvents="none"` so it never
 * eats touches.
 *
 * Uses the same react-native-svg gradient as AppBackground (part of the single
 * sanctioned-gradient exception, decisions.md L24). `color` should match the
 * local background at that edge (bg at the top, bgBottom at the bottom).
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

type Props = {
  edge: 'top' | 'bottom';
  color: string;
  height?: number;
};

function ScrollFadeBase({ edge, color, height = 28 }: Props) {
  const top = edge === 'top';
  return (
    <View
      style={[styles.base, top ? styles.top : styles.bottom, { height }]}
      pointerEvents="none"
    >
      <Svg width="100%" height={height}>
        <Defs>
          <LinearGradient id={`floqFade-${edge}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={top ? 1 : 0} />
            <Stop offset="1" stopColor={color} stopOpacity={top ? 0 : 1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height={height} fill={`url(#floqFade-${edge})`} />
      </Svg>
    </View>
  );
}

export const ScrollFade = memo(ScrollFadeBase);

const styles = StyleSheet.create({
  base: { position: 'absolute', left: 0, right: 0 },
  top: { top: 0 },
  bottom: { bottom: 0 },
});
