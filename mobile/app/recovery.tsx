/**
 * Recovery screen (PR3 / L17 + L19). The post-DONE dwell space:
 *
 *   • a live countdown (Reanimated tick, off-JS-thread — same shape as
 *     `SessionTimer`) shows how long is left of the recommended break
 *   • the **Mark task done** affordance (Option 7 / L19) lives here, NOT on
 *     the summary screen — the summary disappears too fast to read, while
 *     recovery has minutes of dwell for the decision
 *   • two CTAs: **Start next session** (primary once the countdown hits 0,
 *     subtler before) and **Skip recovery** (ghost)
 *
 * Recovery is recommended + skippable (L17): Start is never blocked, and
 * under-resting trims the *next* session's recommendation via `recovery_mod`
 * (M4.7). Tap-anywhere does NOT dismiss this screen — the dwell is the
 * mechanism. Starting / skipping cancels the pending end-of-break
 * notification so it can never fire mid-Session 2 (Bug #3 fix).
 *
 * Routes from `app/session-summary.tsx` after an 8-second stats glance.
 * Params: `breakMinutes` + optional `taskId` / `taskTitle` (for the
 * Mark-done affordance) + a fallback `nextTaskId` (older path).
 */
import { useCallback, useState } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedReaction,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { Button, Text } from '../components/ui';
import { computeSessionPlan } from '../services/session/compute';
import { cancelBreakReminder } from '../services/notifications';
import { selectTopTask, useTaskStore } from '../stores/useTaskStore';
import { useTheme } from '../theme';
import { getTextStyle } from '../theme/typography';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** seconds → "MM:SS". Worklet — runs on the UI thread inside useAnimatedProps. */
function formatTime(totalSeconds: number): string {
  'worklet';
  const s = totalSeconds < 0 ? 0 : Math.floor(totalSeconds);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = sec < 10 ? `0${sec}` : `${sec}`;
  return `${mm}:${ss}`;
}

export default function RecoveryScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    breakMinutes?: string;
    taskId?: string;
    taskTitle?: string;
    nextTaskId?: string;
  }>();

  const breakMinutes = Math.max(0, Number(params.breakMinutes ?? 0));
  const breakSeconds = breakMinutes * 60;

  // The just-finished task identity (from focus.tsx → summary → here). If it's
  // still in the queue, the Mark-task-done affordance shows.
  const finishedTaskId = typeof params.taskId === 'string' ? params.taskId : '';
  const finishedTaskTitle = typeof params.taskTitle === 'string' ? params.taskTitle : '';
  const finishedTaskStillInQueue = useTaskStore((s) =>
    finishedTaskId ? s.tasks.some((t) => t.id === finishedTaskId) : false,
  );
  const markDone = useTaskStore((s) => s.markDone);

  // "Start next session" picks up whichever task is currently the top. If the
  // user just tapped Mark task done, top has already auto-promoted to the next
  // one. nextTaskId param is a legacy fallback; the live store query wins.
  const nextTask = useTaskStore((s) => selectTopTask(s));

  // Wall-clock anchor at mount. remaining = breakSeconds − elapsed, clamped ≥0.
  // Same drift-free pattern as SessionTimer: a remount or backgrounding can't
  // make the clock pause or restart — it's a pure function of wall time.
  const startedAtMs = useSharedValue(Date.now());
  const remainingSec = useSharedValue(breakSeconds);

  useFrameCallback(() => {
    'worklet';
    const elapsed = Math.floor((Date.now() - startedAtMs.value) / 1000);
    const rem = breakSeconds - elapsed;
    remainingSec.value = rem < 0 ? 0 : rem;
  });

  // The big countdown — animated text prop, never re-renders React.
  const timerProps = useAnimatedProps(() => {
    return { text: formatTime(remainingSec.value) } as unknown as Partial<TextInputProps>;
  });

  // Whether the countdown has reached 0 — flips React state ONCE at the
  // boundary so the CTA emphasis can change without per-second renders.
  const [done, setDone] = useState(false);
  useAnimatedReaction(
    () => remainingSec.value <= 0,
    (cur, prev) => {
      if (cur !== prev) runOnJS(setDone)(cur);
    },
  );

  const onMarkDone = useCallback(() => {
    if (!finishedTaskId) return;
    markDone(finishedTaskId);
  }, [finishedTaskId, markDone]);

  const onStartNext = useCallback(() => {
    const task = selectTopTask(useTaskStore.getState());
    if (!task) return;
    // Skipping into the next session implicitly skips any remaining recovery.
    // Cancel the still-pending end-of-break notification (Bug #3 fix; mirrors
    // useStartSession.launch).
    void cancelBreakReminder();
    try {
      const plan = computeSessionPlan(task.id);
      router.replace({
        pathname: '/focus',
        params: { taskId: task.id, plan: JSON.stringify(plan) },
      });
    } catch (err) {
      if (__DEV__) console.warn('[recovery] failed to start next session', err);
    }
  }, []);

  const onSkip = useCallback(() => {
    void cancelBreakReminder();
    router.replace('/home');
  }, []);

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.bg,
          paddingTop: insets.top + 32,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <View style={styles.body}>
        <Text variant="heading" color={theme.textMuted}>
          Recovery
        </Text>
        <AnimatedTextInput
          editable={false}
          caretHidden
          scrollEnabled={false}
          underlineColorAndroid="transparent"
          defaultValue={formatTime(breakSeconds)}
          animatedProps={timerProps}
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={[getTextStyle('display', theme), styles.timer]}
        />

        {/* L19 / Option 7 — the task-done decision lives here, not on the
            summary (which the user reported disappears too fast — 2026-05-29).
            Default = task stays; the user marks complete on a single explicit
            tap. Hidden once the user has marked it (or if the task ID is
            stale — e.g. already done elsewhere). */}
        {finishedTaskId && finishedTaskStillInQueue ? (
          <View style={styles.taskRow}>
            <Text
              variant="body"
              color={theme.textMuted}
              numberOfLines={2}
              style={styles.taskTitle}
            >
              {finishedTaskTitle}
            </Text>
            <Button
              label="Mark task done"
              variant="secondary"
              size="md"
              onPress={onMarkDone}
            />
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        {nextTask ? (
          <Button
            label="Start next session"
            variant={done ? 'primary' : 'secondary'}
            onPress={onStartNext}
          />
        ) : null}
        <Button label="Skip recovery" variant="ghost" size="md" onPress={onSkip} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 },
  timer: { textAlign: 'center', padding: 0 },
  taskRow: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  taskTitle: { textAlign: 'center' },
  actions: { gap: 8 },
});
