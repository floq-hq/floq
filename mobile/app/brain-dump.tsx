/**
 * Brain-dump modal — PLACEHOLDER (S2.3 wires the entry point; S2.4 builds the
 * real thing). Opened by Home's "+" and the empty-state CTA. S2.4 replaces the
 * body with the free-text capture → parseTasks() → parsed-list review, plus the
 * understated ManualTaskForm path (task-queue.md).
 *
 * Presented modally — see the Stack.Screen registration in app/_layout.tsx.
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '../components/ui';
import { useTheme } from '../theme';

export default function BrainDumpModal() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.center}>
        <Text variant="title">Brain-dump</Text>
        <Text variant="body" color={theme.textMuted} style={styles.copy}>
          Dump everything on your mind — capture and task parsing land in S2.4.
        </Text>
      </View>
      <Button label="Close" variant="secondary" onPress={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  copy: { textAlign: 'center' },
});
