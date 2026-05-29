/**
 * Bottom tab navigator: Home / Session / Stats / Partner / More.
 * Headerless — each screen paints its own themed background and header copy.
 *
 * The bottom bar is the handoff `FloqTabBar` ("Top Hairline" treatment),
 * wired in via Expo Router's `tabBar` slot. The adapter below maps the router's
 * active route ↔ the bar's `TabKey` (route names match the bar's keys 1:1) and
 * navigates on press. A bottom safe-area inset lets the floating bar clear the
 * home indicator.
 *
 * The Session tab is a launchpad (top task + START). Starting a session pushes
 * the full-screen /focus route, which renders OVER the tabs — so the bar
 * disappears for the duration (no escape, no pause) and returns on DONE.
 */
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FloqTabBar, type TabKey } from '../../components/FloqTabBar';
import { useTheme } from '../../theme';

function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const active = state.routes[state.index]?.name as TabKey;

  return (
    <View style={{ backgroundColor: theme.bg, paddingBottom: Math.max(insets.bottom, 8) }}>
      <FloqTabBar
        active={active}
        onChange={(key) => {
          if (key !== active) navigation.navigate(key);
        }}
      />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AppTabBar {...props} />}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="session" options={{ title: 'Session' }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats' }} />
      <Tabs.Screen name="partner" options={{ title: 'Partner' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
