/**
 * First-time visual (Home redesign, First-time state) — a calm concentric
 * "ripple" in the brand accent, fading outward. Purely decorative and static
 * (no animation, no JS-thread work); it sets a calm tone on the empty Welcome
 * screen where there's no data to show yet.
 */
import { memo } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '../../theme';

const SIZE = 180;
const C = SIZE / 2;
// Radii from inner to outer; opacity fades as they grow.
const RINGS = [
  { r: 22, opacity: 0.9 },
  { r: 44, opacity: 0.5 },
  { r: 66, opacity: 0.28 },
  { r: 86, opacity: 0.14 },
];

function FirstTimeVisualBase() {
  const theme = useTheme();
  return (
    <View style={{ width: SIZE, height: SIZE }} pointerEvents="none">
      <Svg width={SIZE} height={SIZE}>
        <Circle cx={C} cy={C} r={8} fill={theme.accent} />
        {RINGS.map((ring) => (
          <Circle
            key={ring.r}
            cx={C}
            cy={C}
            r={ring.r}
            stroke={theme.accent}
            strokeWidth={2}
            strokeOpacity={ring.opacity}
            fill="none"
          />
        ))}
      </Svg>
    </View>
  );
}

export const FirstTimeVisual = memo(FirstTimeVisualBase);
