/**
 * Session tab — the launchpad. Shows the task you're about to focus on (the top
 * task) and a START SESSION button; starting opens the full-screen /focus session
 * via the shared useStartSession flow (identical to Home's START). Empty queue →
 * a nudge to brain-dump.
 *
 * The timer itself is NOT here — it's the /focus takeover that renders over the
 * tabs, so the bottom bar disappears while focusing and returns on DONE.
 */
import { useEffect } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Pill, Text } from '../../components/ui';
import { FirstSessionFramingCard } from '../../components/FirstSessionFramingCard';
import { useStartSession } from '../../components/session/useStartSession';
import { selectTopTask, useTaskStore } from '../../stores/useTaskStore';
import { useTheme } from '../../theme';

export default function SessionTab() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const hydrated = useTaskStore((s) => s.hydrated);
  const hydrate = useTaskStore((s) => s.hydrate);
  const topTask = useTaskStore(selectTopTask);
  const { onStart, launching, showIntro, onIntroDismiss } = useStartSession(topTask);

  // Load the persisted queue once on first mount (mirrors Home).
  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <View style={styles.body}>
        {topTask ? (
          <View style={styles.block}>
            <Text variant="caption" color={theme.textMuted} style={styles.center}>
              Up next
            </Text>
            <Card>
              <Text variant="heading">{topTask.title}</Text>
              <View style={styles.pills}>
                <Pill label={`${topTask.estMinutes} min`} color={theme.textMuted} />
                <Pill label={`Difficulty ${topTask.difficulty}/5`} color={theme.accent} />
              </View>
            </Card>
          </View>
        ) : (
          <View style={styles.empty}>
            <Text variant="title" style={styles.center}>
              Nothing to focus on yet
            </Text>
            <Text variant="body" color={theme.textMuted} style={styles.center}>
              Brain-dump your tasks, then come back to start.
            </Text>
          </View>
        )}
      </View>

      {topTask ? (
        <Button label="START SESSION" onPress={onStart} loading={launching} />
      ) : (
        <Button label="Brain-dump" onPress={() => router.push('/brain-dump')} />
      )}

      <FirstSessionFramingCard visible={showIntro} onDismiss={onIntroDismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  body: { flex: 1, justifyContent: 'center' },
  block: { gap: 12 },
  pills: { flexDirection: 'row', gap: 8, marginTop: 12 },
  empty: { alignItems: 'center', gap: 8 },
  center: { textAlign: 'center' },
});
