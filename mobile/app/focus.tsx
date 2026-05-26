/**
 * Focus session screen (S3.1) — the timer. A root-level full-screen route at
 * /focus (NOT a tab): START on Home or the Session-tab launchpad opens it, and
 * because it renders over the tabs there's no bottom bar / pause / escape while
 * you're in it (mobile/CLAUDE.md: "No pause button. Pausing IS a distraction").
 * The GOT DISTRACTED (S3.2) and DONE (S3.3) controls live here.
 *
 * The launcher (useStartSession) hands off { taskId, plan } via route params. The plan drives the phase
 * boundaries; the task id resolves the title shown under the clock. On mount the
 * screen opens the in-flight session in the active-session store (M3.2); DONE
 * ends it, writes the record (writeSession, M3.2), promotes the next task
 * (markDone, M2.5), and routes to the summary.
 *
 * Timing model: a single shared `elapsedSeconds`, advanced by a Reanimated frame
 * callback on the UI thread (no per-second setState). The clock display reads it
 * directly (SessionTimer). Phase is the ONLY thing kept in React state, and it's
 * updated solely at transitions — useAnimatedReaction fires once per whole second
 * and runOnJS(phaseFor) flips state only when the phase actually changes. phaseFor
 * (M3.1) stays the single source of truth for boundaries; we never re-derive them.
 *
 * (The frame clock drives the on-screen display; the recorded focus minutes use
 * the store's wall-clock startedAt so backgrounded time isn't undercounted.)
 */
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  runOnJS,
  useAnimatedReaction,
  useFrameCallback,
  useSharedValue,
} from 'react-native-reanimated';
import { Button, Text } from '../components/ui';
import { PhaseIndicator } from '../components/session/PhaseIndicator';
import { SessionTimer } from '../components/session/SessionTimer';
import { DistractionButton } from '../components/session/DistractionButton';
import { phaseFor, type Phase, type SessionPlan } from '../services/timer';
import { writeSession } from '../services/session/distraction';
import type { CompletedSession } from '../services/session/types';
import { useTaskStore } from '../stores/useTaskStore';
import { useActiveSessionStore } from '../stores/useActiveSessionStore';
import { useTheme } from '../theme';

// App version stamped on the session record. From app.json; move to
// expo-constants (Constants.expoConfig.version) if that dependency is added.
const CLIENT_VERSION = '1.0.0';

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
  const task = useTaskStore((s) => s.tasks.find((t) => t.id === params.taskId));
  const startSession = useActiveSessionStore((s) => s.startSession);
  const endSession = useActiveSessionStore((s) => s.endSession);
  const markDone = useTaskStore((s) => s.markDone);

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

  // Begin the in-flight session in the active-session store (M3.2) so the
  // distraction button (S3.2) — and the Done writer (S3.3) — have a session to
  // act on; logDistraction no-ops without one. Once per mount: a fresh START is
  // a fresh session and the route params are stable for the screen's lifetime.
  useEffect(() => {
    if (!plan || !task) return;
    startSession({
      taskId: task.id,
      task: { title: task.title, difficulty: task.difficulty, estMinutes: task.estMinutes },
      plan,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  // DONE: end the session, persist it, promote the next task, show the summary.
  const onDone = useCallback(() => {
    const snapshot = endSession(); // returns the in-flight session, then clears it
    if (!snapshot) {
      router.replace('/home');
      return;
    }

    const endedAt = Date.now();
    // Wall-clock from the store's startedAt (M3.2) — not the frame clock, which
    // pauses while backgrounded — so the recorded minutes aren't undercounted.
    const minutesFocused = Math.max(0, Math.round((endedAt - snapshot.startedAt) / 60_000));
    const distractions = snapshot.distractions.length;

    // Focus score is M4.1 — a frozen formula in Mohamed's timer service that isn't
    // merged yet, and we must not reimplement it. No real score to compute: write 0
    // as a placeholder and show "—" in the summary. One-line swap to
    // computeFocusScore(...) the moment M4.1 lands.
    const focusScore: number | null = null;

    const completed: CompletedSession = {
      id: snapshot.sessionId,
      taskId: snapshot.taskId,
      task: snapshot.task,
      plan: snapshot.plan,
      startedAt: snapshot.startedAt,
      endedAt,
      actualFocusMinutes: minutesFocused,
      focusScore: focusScore ?? 0,
      distractions: snapshot.distractions,
      clientVersion: CLIENT_VERSION,
    };

    // Best-effort write via Mohamed's persistence layer (M3.2). Don't block the
    // hand-off to the summary on the network, and don't lose the rest of the flow
    // if it fails (offline / signed-out) — SQLite becomes the source of truth in M4.2.
    writeSession(completed).catch((err) => {
      if (__DEV__) console.warn('[session] writeSession failed', err);
    });

    // Task promotion (session-flow.md §Task promotion): drop the current task; the
    // next auto-promotes, or an empty queue shows Home's brain-dump prompt.
    markDone(snapshot.taskId);

    router.replace({
      pathname: '/session-summary',
      params: {
        minutes: String(minutesFocused),
        distractions: String(distractions),
        breakMinutes: String(snapshot.plan.breakMinutes),
        ...(focusScore != null ? { score: String(focusScore) } : {}),
      },
    });
  }, [endSession, markDone]);

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
        {task?.title ? (
          <Text variant="body" color={theme.textMuted} style={styles.task} numberOfLines={2}>
            {task.title}
          </Text>
        ) : null}
      </View>

      <View style={styles.controls}>
        <DistractionButton />
        <Button label="DONE" onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  fallback: { alignItems: 'center' },
  top: { alignItems: 'center', paddingTop: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  task: { textAlign: 'center' },
  controls: { gap: 12 },
});
