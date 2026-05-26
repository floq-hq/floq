/**
 * Bottom tab navigator (S2.3): Home / Stats / Friends.
 * Headerless — each screen paints its own themed background and header copy.
 *
 * No Session tab: a focus session is a full-screen, no-escape route (app/
 * session.tsx, S3.1) launched from Home's START SESSION, not a tab you can browse
 * away to mid-session. (Diverges from root CLAUDE.md's 4-tab list — see PR note.)
 *
 * Icons are emoji for now: @expo/vector-icons isn't a dependency and adding one
 * needs sign-off (root CLAUDE.md "always ask before adding a dependency"). The
 * active/inactive tint applies to the label; swapping in a vector-icon set later
 * is a drop-in change to `tabBarIcon`.
 */
import { Tabs } from 'expo-router';
import { Text as RNText } from 'react-native';
import { useTheme } from '../../theme';

const TAB_EMOJI = { home: '◎', stats: '◔', friends: '⦿' } as const;

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
