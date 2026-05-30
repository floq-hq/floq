// FloqTabBar — FLOQ bottom navigation, "Top Hairline" active treatment.
// Handoff component (Mustafa's design), adapted to wire into Expo Router's
// file-based tabs via the `tabBar` adapter in app/(tabs)/_layout.tsx.
//
// Design-system compliant (shared/spec/design-system.md):
//   • Plain StyleSheet + useTheme() — no NativeWind, no styled-components.
//   • Never references raw hex; every color comes from the active token set
//     (bgElevated, border, accent, textMuted). Follows System/Light/Dark.
//   • No gradients / glassmorphism / glow / shadows. One 1px border on the bar.
//   • Inter weight 500 labels (13px) — weight-only, matching the app's current
//     system-font convention (Inter family files load in a later task; see
//     theme/typography.ts). Active = accent, inactive = textMuted.
//   • The center "Session" tab uses the brand `oq` ligature as an outline mark.
//
// Controlled component: parent owns `active` + `onChange`. The Expo Router
// adapter maps the router's active route ↔ TabKey.
//
// Deps: react-native-svg.

import React, { useEffect, useRef } from 'react';
import {
  View,
  Pressable,
  Text,
  StyleSheet,
  Animated,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { useTheme } from '../theme';
import { indicatorTranslateX } from './FloqTabBar.helpers';

// ---------------------------------------------------------------------------
// Icons — outline set, 24×24, strokeWidth 2 (Lucide-weight). Color is driven
// by the `color` prop so active/inactive tint is a single source of truth.
// ---------------------------------------------------------------------------

type IconProps = { color: string };
const SW = 2;
const ICON = 24;

const HouseIcon = ({ color }: IconProps) => (
  <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none">
    <Path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

// Brand `oq` ligature, drawn as an outline mark to match the icon weight.
const OqIcon = ({ color }: IconProps) => (
  <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none">
    <Circle cx={8} cy={9.6} r={4.2} stroke={color} strokeWidth={SW} />
    <Circle cx={15.8} cy={9.6} r={4.2} stroke={color} strokeWidth={SW} />
    <Path d="M20 9.6 V18.4" stroke={color} strokeWidth={SW} strokeLinecap="round" />
  </Svg>
);

const ChartIcon = ({ color }: IconProps) => (
  <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none">
    <Path d="M3 3v16a2 2 0 0 0 2 2h16" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M18 17V9" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M13 17V5" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M8 17v-3" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const UsersIcon = ({ color }: IconProps) => (
  <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none">
    <Path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    <Circle cx={9} cy={7} r={4} stroke={color} strokeWidth={SW} />
    <Path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
    <Path d="M16 3.13a4 4 0 0 1 0 7.75" stroke={color} strokeWidth={SW} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>
);

const MenuIcon = ({ color }: IconProps) => (
  <Svg width={ICON} height={ICON} viewBox="0 0 24 24" fill="none">
    <Line x1={4} x2={20} y1={6} y2={6} stroke={color} strokeWidth={SW} strokeLinecap="round" />
    <Line x1={4} x2={20} y1={12} y2={12} stroke={color} strokeWidth={SW} strokeLinecap="round" />
    <Line x1={4} x2={20} y1={18} y2={18} stroke={color} strokeWidth={SW} strokeLinecap="round" />
  </Svg>
);

// ---------------------------------------------------------------------------
// Tab model — keys are the Expo Router route names in app/(tabs)/ so the
// adapter maps 1:1 (no translation table).
// ---------------------------------------------------------------------------

export type TabKey = 'home' | 'session' | 'stats' | 'partner' | 'more';

const TABS: { key: TabKey; label: string; Icon: React.FC<IconProps> }[] = [
  { key: 'home', label: 'Home', Icon: HouseIcon },
  { key: 'session', label: 'Session', Icon: OqIcon },
  { key: 'stats', label: 'Stats', Icon: ChartIcon },
  { key: 'partner', label: 'Partner', Icon: UsersIcon },
  { key: 'more', label: 'More', Icon: MenuIcon },
];

const HAIRLINE_WIDTH = 30; // px — the active top indicator

type Props = {
  active: TabKey;
  onChange: (key: TabKey) => void;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FloqTabBar({ active, onChange }: Props) {
  const theme = useTheme();
  const activeIndex = Math.max(0, TABS.findIndex((t) => t.key === active));

  // measured width of one tab cell — drives the indicator slide
  const cellWidth = useRef(0);
  const tx = useRef(new Animated.Value(0)).current;

  const moveTo = (index: number, animate: boolean) => {
    const target = indicatorTranslateX(index, cellWidth.current, HAIRLINE_WIDTH);
    // audit #24: no-op until the track is measured — the pre-layout move used to
    // animate the indicator to ≈ -15px off-screen-left, then snap back.
    if (target === null) return;
    if (animate) {
      Animated.timing(tx, {
        toValue: target,
        duration: 340,
        useNativeDriver: true,
      }).start();
    } else {
      tx.setValue(target); // seat instantly — no slide on first/rotated layout
    }
  };

  useEffect(() => {
    moveTo(activeIndex, true); // animate the slide on a tab change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  const onTrackLayout = (e: LayoutChangeEvent) => {
    cellWidth.current = e.nativeEvent.layout.width / TABS.length;
    moveTo(activeIndex, false); // re-seat without animation on first/rotated layout
  };

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: theme.bgElevated, borderColor: theme.border },
      ]}
    >
      <View style={styles.track} onLayout={onTrackLayout}>
        {/* sliding hairline */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.hairline,
            { width: HAIRLINE_WIDTH, backgroundColor: theme.accent, transform: [{ translateX: tx }] },
          ]}
        />

        {TABS.map((tab) => {
          const isActive = tab.key === active;
          const color = isActive ? theme.accent : theme.textMuted;
          return (
            <Pressable
              key={tab.key}
              onPress={() => onChange(tab.key)}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={tab.label}
              hitSlop={6}
            >
              <tab.Icon color={color} />
              <Text style={[styles.label, { color }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 72,
    marginHorizontal: 12, // floats inset from the screen edges
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    // no shadow — per design-system.md
  },
  track: {
    flex: 1,
    height: '100%',
    flexDirection: 'row',
    position: 'relative',
  },
  hairline: {
    position: 'absolute',
    top: 0,
    left: 0,
    height: 2.5,
    borderRadius: 2,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
});
