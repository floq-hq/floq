/**
 * AppBackground — the app-wide background gradient. Rendered ONCE at the root,
 * absolutely filling the window BEHIND the whole app (every screen + the tab
 * bar, all the way to the bottom edge). Screens paint no solid background, so
 * this shows through everywhere.
 *
 * A subtle vertical deepening (`bg` → `bgBottom`) for ambient depth — NOT a dark
 * overlay on top of content. design-system.md bans gradients; this is the single
 * sanctioned exception, approved by Mohamed and logged in decisions.md L24.
 * Rendered with react-native-svg (already a dependency).
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '../../theme';

function AppBackgroundBase() {
  const theme = useTheme();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="floqAppBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={theme.bg} />
            <Stop offset="0.5" stopColor={theme.bg} />
            <Stop offset="1" stopColor={theme.bgBottom} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#floqAppBg)" />
      </Svg>
    </View>
  );
}

export const AppBackground = memo(AppBackgroundBase);
