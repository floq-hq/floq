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
 * START SESSION runs the S3.0 start-session flow: compute the plan for the top
 * task (computeSessionPlan, M3.3), gate the one-time framing card (S2.5), then
 * navigate to /session. The session screen UI itself lands in S3.1.
 *
 * Lives at /home (not (tabs)/index) because app/index.tsx is the auth gate and
 * already owns "/"; the gate redirects an onboarded user straight here.
 */
import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Card, Pill, Text } from '../../components/ui';
import { StreakCounter } from '../../components/StreakCounter';
import { FirstSessionFramingCard } from '../../components/FirstSessionFramingCard';
import { selectHiddenCount, selectTopTask, useTaskStore } from '../../stores/useTaskStore';
import { getHasSeenIntro } from '../../services/intro/seen';
import { computeSessionPlan } from '../../services/session/compute';
import { useTheme } from '../../theme';

export default function Home() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const hydrated = useTaskStore((s) => s.hydrated);
  const hydrate = useTaskStore((s) => s.hydrate);
  const topTask = useTaskStore(selectTopTask);
  const hiddenCount = useTaskStore(selectHiddenCount);
  const [showIntro, setShowIntro] = useState(false);
  const [launching, setLaunching] = useState(false);

  // Load the persisted queue once on first mount (mirrors the onboarding gate).
  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  const openBrainDump = () => router.push('/brain-dump');

  // S3.0 — start the session. Compute the plan AT session start (CLAUDE.md:
  // "recompute at session start, not once per day") behind a loading state so
  // the tap never feels janky, then hand off to /session. computeSessionPlan
  // (M3.3) is synchronous, so we defer a frame: lets the loading state paint and
  // keeps a thrown invariant out of the press handler's render path.
  const launchSession = useCallback(() => {
    if (!topTask || launching) return;
    setLaunching(true);
    setTimeout(() => {
      try {
        const plan = computeSessionPlan(topTask.id);
        // Handoff via route params — no new store, so we don't pre-empt Mohamed's
        // M3.2 useActiveSessionStore. The plan is small + JSON-serializable; the
        // session screen (S3.1) reads { taskId, plan }.
        router.push({
          pathname: '/session',
          params: { taskId: topTask.id, plan: JSON.stringify(plan) },
        });
      } catch (err) {
        // topTask is guaranteed (button only renders with one) and onboarding by
        // the routing gate, so a throw here is a real bug — surface it, don't nav.
        if (__DEV__) console.warn('[session] failed to start session', err);
        setLaunching(false);
      }
    }, 0);
  }, [topTask, launching]);

  // Show the framing card once before the user's very first session (S2.5), then
  // launch; skip straight to launch on later sessions.
  const onStartSession = useCallback(() => {
    if (getHasSeenIntro()) launchSession();
    else setShowIntro(true);
  }, [launchSession]);
  const onIntroDismiss = useCallback(() => {
    setShowIntro(false);
    launchSession();
  }, [launchSession]);

  // Returning from a session refocuses Home — re-enable START.
  useFocusEffect(useCallback(() => setLaunching(false), []));

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
        <StreakCounter />
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
        <Button label="START SESSION" onPress={onStartSession} loading={launching} />
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
  body: { flex: 1, justifyContent: 'center' },
  taskBlock: { gap: 12 },
  pills: { flexDirection: 'row', gap: 8, marginTop: 12 },
  hidden: { textAlign: 'center' },
  empty: { alignItems: 'center', gap: 8 },
  center: { textAlign: 'center' },
});
