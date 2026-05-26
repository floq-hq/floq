/**
 * Friends tab — PLACEHOLDER. The opt-in leaderboard and async session feed come
 * later. Here so the tab bar is complete.
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
        Your friends-only leaderboard and session feed land later.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  copy: { textAlign: 'center' },
});
