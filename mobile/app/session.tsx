/**
 * Session screen (S3.1) — the focus timer. A root-level full-screen route (NOT a
 * tab): you start it from Home, and there's no tab bar / pause / escape while
 * you're in it (mobile/CLAUDE.md: "No pause button. Pausing IS a distraction").
 * Distraction + Done land in S3.2 / S3.3.
 *
 * S3.0 hands off { taskId, plan } via route params. The plan drives the phase
 * boundaries; the task id resolves the title shown under the clock.
 *
 * Timing model: a single shared `elapsedSeconds`, advanced by a Reanimated frame
 * callback on the UI thread (no per-second setState). The clock display reads it
 * directly (SessionTimer). Phase is the ONLY thing kept in React state, and it's
 * updated solely at transitions — useAnimatedReaction fires once per whole second
 * and runOnJS(phaseFor) flips state only when the phase actually changes. phaseFor
 * (M3.1) stays the single source of truth for boundaries; we never re-derive them.
 *
 * (Authoritative start time + persistence across backgrounding arrive with M3.2's
 * useActiveSessionStore; the frame clock is enough for the W3 session UI.)
 */
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  runOnJS,
  useAnimatedReaction,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { Text } from '../components/ui';
import { PhaseIndicator } from '../components/session/PhaseIndicator';
import { SessionTimer } from '../components/session/SessionTimer';
import { phaseFor, type Phase, type SessionPlan } from '../services/timer';
import { useTaskStore } from '../stores/useTaskStore';
import { useTheme } from '../theme';

/** Parse the serialized plan from the route param; null on anything malformed. */
function parsePlan(raw: string | string[] | undefined): SessionPlan | null {
  if (typeof raw !== 'string') return null;
  try {
    const p: unknown = JSON.parse(raw);
    if (
      typeof p === 'object' &&
      p !== null &&
      typeof (p as SessionPlan).focusMinutes === 'number' &&
      typeof (p as SessionPlan).breakMinutes === 'number'
    ) {
      return p as SessionPlan;
    }
    return null;
  } catch {
    return null;
  }
}

export default function SessionScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ taskId?: string; plan?: string }>();
  const plan = parsePlan(params.plan);
  const taskTitle = useTaskStore((s) => s.tasks.find((t) => t.id === params.taskId)?.title);

  const elapsedSeconds = useSharedValue(0);
  const [phase, setPhase] = useState<Phase>('struggle');

  // Advance the clock on the UI thread. timeSinceFirstFrame is ms since this
  // callback's first frame ≈ session start; flooring gives whole seconds.
  useFrameCallback((frame) => {
    'worklet';
    elapsedSeconds.value = Math.floor(frame.timeSinceFirstFrame / 1000);
  });

  // Recompute the phase only when the whole-second value changes, and commit to
  // React state only on an actual transition — the one allowed setState path.
  const syncPhase = useCallback(
    (sec: number) => {
      if (!plan) return;
      const next = phaseFor(sec, plan);
      setPhase((cur) => (cur === next ? cur : next));
    },
    [plan],
  );
  useAnimatedReaction(
    () => elapsedSeconds.value,
    (cur, prev) => {
      if (cur !== prev) runOnJS(syncPhase)(cur);
    },
  );

  // Defensive: S3.0 always passes a plan, but a stray deep link shouldn't crash.
  if (!plan) {
    return (
      <View style={[styles.root, styles.fallback, { backgroundColor: theme.bg, paddingTop: insets.top + 24 }]}>
        <Text variant="body" color={theme.textMuted}>
          No active session.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.bg, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.top}>
        <PhaseIndicator phase={phase} />
      </View>

      <View style={styles.center}>
        <SessionTimer elapsedSeconds={elapsedSeconds} />
        {taskTitle ? (
          <Text variant="body" color={theme.textMuted} style={styles.task} numberOfLines={2}>
            {taskTitle}
          </Text>
        ) : null}
      </View>

      {/* Reserved for the GOT DISTRACTED (S3.2) + DONE (S3.3) controls. */}
      <View style={styles.controls} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  fallback: { alignItems: 'center' },
  top: { alignItems: 'center', paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  task: { textAlign: 'center' },
  controls: { minHeight: 72 },
});
