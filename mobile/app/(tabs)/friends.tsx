/**
 * Friends tab — PLACEHOLDER, awaiting S7.0 (W7).
 *
 * Per decisions.md L18 (social-as-core) this tab becomes the **Partner** tab
 * with a 1:1 focus-partnership UX — invite affordance, partner's scheduled +
 * completed sessions, gentle pair streak, and the activation funnel that's
 * the make-or-break of the pivot. The rename + the real UI both land with
 * S7.0 (mobile/CLAUDE.md: "Rename the 'Friends' tab to 'Partner' when wiring
 * S7.0"). For now: an L18-aligned placeholder that doesn't promise a
 * leaderboard / friend-list (both dead per L18) and reassures solo is fully
 * available today (no dead-end).
 */
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/ui';
import { useTheme } from '../../theme';

export default function FriendsTab() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top + 56 }]}>
      <Text variant="title">Friends</Text>
      <Text variant="body" color={theme.textMuted} style={styles.copy}>
        Your focus partner lands in W7. Solo is fully available today — nothing
        here blocks the rest of the app.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  copy: { textAlign: 'center' },
});
