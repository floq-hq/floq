/**
 * Home (S2.3) — the focus launchpad. Shows exactly one task (title + est-minutes
 * + difficulty pills), a "+N hidden" hint for the rest of the queue, the streak
 * top-right, and the primary START SESSION action. Empty queue → a brain-dump
 * nudge instead.
 *
 * Reads the queue from useTaskStore (M2.5) via selectTopTask / selectHiddenCount
 * — one visible task at a time (session-flow.md). The "+" and the empty-state
 * CTA both open the brain-dump modal (S2.4 fleshes that screen out).
 *
 * START SESSION runs the shared start-session flow (useStartSession): compute the
 * plan for the top task (computeSessionPlan, M3.3), gate the one-time framing card
 * (S2.5), then open the full-screen /focus session. The Session tab launchpad
 * starts a session the exact same way.
 *
 * Lives at /home (not (tabs)/index) because app/index.tsx is the auth gate and
 * already owns "/"; the gate redirects an onboarded user straight here.
 */
import { useEffect } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Pill, Text } from '../../components/ui';
import { StreakCounter } from '../../components/StreakCounter';
import { FirstSessionFramingCard } from '../../components/FirstSessionFramingCard';
import { useStartSession } from '../../components/session/useStartSession';
import { selectHiddenCount, selectTopTask, useTaskStore } from '../../stores/useTaskStore';
import { useTheme } from '../../theme';

export default function Home() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const hydrated = useTaskStore((s) => s.hydrated);
  const hydrate = useTaskStore((s) => s.hydrate);
  const topTask = useTaskStore(selectTopTask);
  const hiddenCount = useTaskStore(selectHiddenCount);
  const { onStart, launching, showIntro, onIntroDismiss } = useStartSession(topTask);

  // Load the persisted queue once on first mount (mirrors the onboarding gate).
  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  const openBrainDump = () => router.push('/brain-dump');

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add tasks"
          onPress={openBrainDump}
          hitSlop={12}
        >
          <Text variant="title" color={theme.accent}>
            +
          </Text>
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Settings"
            onPress={() => router.push('/settings')}
            hitSlop={12}
          >
            <Text variant="heading" color={theme.textMuted}>
              {'⚙︎'}
            </Text>
          </Pressable>
          <StreakCounter />
        </View>
      </View>

      <View style={styles.body}>
        {topTask ? (
          <View style={styles.taskBlock}>
            <Card>
              <Text variant="heading">{topTask.title}</Text>
              <View style={styles.pills}>
                <Pill label={`${topTask.estMinutes} min`} color={theme.textMuted} />
                <Pill label={`Difficulty ${topTask.difficulty}/5`} color={theme.accent} />
              </View>
            </Card>
            {hiddenCount > 0 ? (
              <Pressable
                onPress={() => router.push('/task-queue')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`${hiddenCount} more tasks — open the queue`}
              >
                <Text variant="caption" color={theme.textMuted} style={styles.hidden}>
                  +{hiddenCount} hidden
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.empty}>
            <Text variant="title" style={styles.center}>
              Nothing queued
            </Text>
            <Text variant="body" color={theme.textMuted} style={styles.center}>
              Brain-dump what you need to do today.
            </Text>
          </View>
        )}
      </View>

      {topTask ? (
        <Button label="START SESSION" onPress={onStart} loading={launching} />
      ) : (
        <Button label="Brain-dump" onPress={openBrainDump} />
      )}

      <FirstSessionFramingCard visible={showIntro} onDismiss={onIntroDismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  body: { flex: 1, justifyContent: 'center' },
  taskBlock: { gap: 12 },
  pills: { flexDirection: 'row', gap: 8, marginTop: 12 },
  hidden: { textAlign: 'center' },
  empty: { alignItems: 'center', gap: 8 },
  center: { textAlign: 'center' },
});
