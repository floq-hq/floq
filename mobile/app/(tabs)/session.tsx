/**
 * Session tab — PLACEHOLDER. The adaptive focus timer, phase indicator, and
 * distraction logging are W3 (S3.x). This exists so the tab bar is complete and
 * START SESSION has a target.
 */
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../components/ui';
import { useTheme } from '../../theme';

export default function SessionTab() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top + 56 }]}>
      <Text variant="title">Session</Text>
      <Text variant="body" color={theme.textMuted} style={styles.copy}>
        The adaptive focus timer and phase indicator arrive in W3.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, alignItems: 'center', gap: 8 },
  copy: { textAlign: 'center' },
});
