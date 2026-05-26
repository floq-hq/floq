/**
 * Bottom tab navigator (S2.3): Home / Session / Stats / Friends (root CLAUDE.md).
 * Headerless — each screen paints its own themed background and header copy.
 *
 * Icons are emoji for now: @expo/vector-icons isn't a dependency and adding one
 * needs sign-off (root CLAUDE.md "always ask before adding a dependency"). The
 * active/inactive tint applies to the label; swapping in a vector-icon set later
 * is a drop-in change to `tabBarIcon`.
 */
import { Tabs } from 'expo-router';
import { Text as RNText } from 'react-native';
import { useTheme } from '../../theme';

const TAB_EMOJI = { home: '◎', session: '⏱', stats: '◔', friends: '⦿' } as const;

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: theme.bgElevated,
          borderTopColor: theme.border,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <RNText style={{ fontSize: size, color }}>{TAB_EMOJI.home}</RNText>
          ),
        }}
      />
      <Tabs.Screen
        name="session"
        options={{
          title: 'Session',
          tabBarIcon: ({ color, size }) => (
            <RNText style={{ fontSize: size, color }}>{TAB_EMOJI.session}</RNText>
          ),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, size }) => (
            <RNText style={{ fontSize: size, color }}>{TAB_EMOJI.stats}</RNText>
          ),
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color, size }) => (
            <RNText style={{ fontSize: size, color }}>{TAB_EMOJI.friends}</RNText>
          ),
        }}
      />
    </Tabs>
  );
}
