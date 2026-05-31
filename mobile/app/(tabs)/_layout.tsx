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
import { useSessionSync } from '../../services/sync/useSessionSync';
import { useTaskSync } from '../../services/sync/useTaskSync';
import { useDataWipeSync } from '../../services/sync/useDataWipeSync';
import { useTelemetryFlush } from '../../services/sync/useTelemetryFlush';

function AppTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const active = state.routes[state.index]?.name as TabKey;

  return (
    // Transparent so the root background gradient shows behind the nav bar.
    <View style={{ paddingBottom: Math.max(insets.bottom, 8) }}>
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
  // Cross-device sync for the life of the signed-in tab tree: pull remote
  // sessions (+ refresh stats) and the task queue (last-write-wins) in real time,
  // and propagate a "Clear history" wipe from any other device of this account.
  useSessionSync();
  useTaskSync();
  useDataWipeSync();
  // L23: best-effort upload of consent-gated, anonymized training samples.
  useTelemetryFlush();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Transparent scene so the root background gradient shows through.
        sceneStyle: { backgroundColor: 'transparent' },
      }}
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
