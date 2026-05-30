/**
 * Small stroke icons for menu rows + headers. Hand-drawn react-native-svg to
 * match FloqTabBar (24×24 viewBox, stroke width 2, round caps) — the app
 * deliberately has no icon library. Each is a React.FC<IconProps> so callers
 * pass a themed `color` (same contract as FloqTabBar's icons).
 */
import Svg, { Path, Circle } from 'react-native-svg';

export type IconProps = { color: string; size?: number };

const SW = 2;
const base = (size = 24) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none' as const });

/** Account / profile (person). */
export const UserIcon = ({ color, size }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={7} r={4} stroke={color} strokeWidth={SW} />
  </Svg>
);

/** Appearance (sun / theme). */
export const SunIcon = ({ color, size }: IconProps) => (
  <Svg {...base(size)}>
    <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={SW} />
    <Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Session behavior (timer). */
export const TimerIcon = ({ color, size }: IconProps) => (
  <Svg {...base(size)}>
    <Circle cx={12} cy={13} r={8} stroke={color} strokeWidth={SW} />
    <Path d="M12 9v4l2.5 2.5M9 2h6" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Privacy (eye). */
export const EyeIcon = ({ color, size }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={SW} />
  </Svg>
);

/** About / info. */
export const InfoIcon = ({ color, size }: IconProps) => (
  <Svg {...base(size)}>
    <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={SW} />
    <Path d="M12 11v5M12 8h.01" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Tutorials (graduation cap). */
export const CapIcon = ({ color, size }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M22 9 12 5 2 9l10 4 10-4Z" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M6 10.5V16c0 1 2.7 2.5 6 2.5s6-1.5 6-2.5v-5.5" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Trailing chevron for menu rows. */
export const ChevronRightIcon = ({ color, size }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M9 6l6 6-6 6" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Back arrow for the sub-screen header. */
export const BackIcon = ({ color, size }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M19 12H5M12 19l-7-7 7-7" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);
