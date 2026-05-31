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

/** Notifications (bell). */
export const BellIcon = ({ color, size }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M13.7 21a2 2 0 0 1-3.4 0" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Data (database cylinder) — the "your data" row. */
export const DatabaseIcon = ({ color, size }: IconProps) => (
  <Svg {...base(size)}>
    <Path d="M4 5c0 1.66 3.58 3 8 3s8-1.34 8-3-3.58-3-8-3-8 1.34-8 3Z" stroke={color} strokeWidth={SW} strokeLinejoin="round" />
    <Path d="M4 5v14c0 1.66 3.58 3 8 3s8-1.34 8-3V5" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M4 12c0 1.66 3.58 3 8 3s8-1.34 8-3" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

/** Official multi-color Google "G" mark (brand asset — NOT themed; fixed colors
 *  per Google's sign-in branding guidelines). Filled paths, viewBox 48. */
export const GoogleLogo = ({ size = 18 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 48 48">
    <Path
      fill="#FFC107"
      d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
    />
    <Path
      fill="#FF3D00"
      d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
    />
    <Path
      fill="#4CAF50"
      d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
    />
    <Path
      fill="#1976D2"
      d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
    />
  </Svg>
);
