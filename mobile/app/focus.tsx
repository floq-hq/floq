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
 * ends it, writes the record via finalizeOnDone (M4.5/M4.6), and routes to the
 * summary. Task promotion is NOT automatic — the summary screen (Option 7 /
 * L19) hosts the explicit "Mark task done" affordance.
 *
 * Timing model: a single shared `elapsedSeconds`, advanced on the UI thread by a
 * Reanimated frame callback (no per-second setState) that derives it from the wall
 * clock — `now - session.startedAt`. Because it's a pure function of real time, the
 * clock survives a remount / re-render / background trip instead of snapping back
 * to 0, which is what "the session cannot be paused" requires (timer.md,
 * session-flow.md). The clock display reads the shared value directly (SessionTimer).
 * Phase is the ONLY thing kept in React state, updated solely at transitions —
 * useAnimatedReaction fires once per whole second and runOnJS(phaseFor) flips state
 * only when the phase actually changes. phaseFor (M3.1) stays the single source of
 * truth for boundaries; we never re-derive them.
 *
 * (The on-screen clock and the recorded focus minutes now share the same wall-clock
 * basis — session.startedAt — so they always agree.)
 */
import { useCallback, useEffect, useRef, useState } from 'react';
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
import { SessionToast } from '../components/session/SessionToast';
import { SuggestedStopMeter } from '../components/session/SuggestedStopMeter';
import { EndEarlySheet } from '../components/session/EndEarlySheet';
import { phaseFor, type Phase, type SessionPlan } from '../services/timer';
import { saveCompletedSession } from '../services/storage/sessions';
import { finalizeOnDone } from '../services/session/finalize';
import { startBackgroundPolicy } from '../services/session/backgroundPolicy';
import { backgroundDistractionMessage } from '../services/session/backgroundNotice';
import { scheduleBreakReminder } from '../services/notifications';
import { queryClient } from '../services/queryClient';
import { statsKeys } from '../services/stats/useStats';
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

  const elapsedSeconds = useSharedValue(0);
  // Wall-clock anchor (session.startedAt). The clock is derived as (now - anchor)
  // every frame, so it survives a remount / re-render / background instead of
  // snapping back to 0 — timeSinceFirstFrame restarts on those, wall-clock doesn't.
  const startedAtMs = useSharedValue(0);
  const [phase, setPhase] = useState<Phase>('struggle');

  // On-return toast (S3.4): { text, key } where key is the leave timestamp, so a
  // second background episode re-triggers the toast even if the wording matches.
  const [bgNotice, setBgNotice] = useState<{ text: string; key: number } | null>(null);
  const dismissNotice = useCallback(() => setBgNotice(null), []);

  // End-early sheet (M4.8). Opened by the understated "End early" affordance
  // alongside DONE — kept visually subordinate so it never reads as DONE.
  const [endEarlyOpen, setEndEarlyOpen] = useState(false);

  // Advance the clock on the UI thread (no per-second setState). Derived purely
  // from the wall clock and the session's startedAt, so it's a stable function of
  // real time — a remount or re-render can't make it jump back to 0.
  useFrameCallback(() => {
    'worklet';
    if (startedAtMs.value === 0) return; // not seeded yet (pre-mount-effect)
    const secs = Math.floor((Date.now() - startedAtMs.value) / 1000);
    elapsedSeconds.value = secs < 0 ? 0 : secs;
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

  // Begin — or RESUME — the in-flight session in the active-session store (M3.2)
  // so the distraction button (S3.2) and the Done writer (S3.3) have a session to
  // act on.
  //
  // Bug #7 (PR3) — the deps array MUST react to `task?.id`. On a Resume from
  // the RestoreSessionPrompt, the screen mounts BEFORE the task store has
  // hydrated (Resume routes straight to /focus without going through Home,
  // which used to be the only hydrate trigger). The original `[]`-deps effect
  // returned early on the first render with no task and never re-fired — so
  // `startedAtMs.value` stayed at 0 and the useFrameCallback gated the clock
  // off. The ref guard keeps a second startSession from firing when the task
  // store hydrates AFTER an existing-session match.
  const sessionInitialized = useRef(false);
  useEffect(() => {
    if (sessionInitialized.current) return;
    if (!plan || !task) return;
    const existing = useActiveSessionStore.getState().active;
    if (existing && existing.taskId === task.id) {
      // Resume: an in-flight session for this task already lives in the store
      // (hydrated at boot in app/index.tsx). Seed the wall-clock anchor from
      // its startedAt — never overwrite it (that's how the original elapsed
      // time and any distractions logged before the kill survive).
      startedAtMs.value = existing.startedAt;
    } else {
      startSession({
        taskId: task.id,
        task: { title: task.title, difficulty: task.difficulty, estMinutes: task.estMinutes },
        plan,
      });
      startedAtMs.value = useActiveSessionStore.getState().active?.startedAt ?? Date.now();
    }
    sessionInitialized.current = true;
  }, [plan, task?.id, startSession, startedAtMs]);

  // Background-during-session policy (M3.4): while this screen is mounted, watch
  // AppState. If the app is backgrounded past the user's threshold (decisions.md
  // L15), M3.4 logs a distraction via the M3.2 funnel and calls back so we can
  // surface the on-return toast (S3.4). Tear the listener down on unmount.
  useEffect(() => {
    const stop = startBackgroundPolicy({
      onBackgroundDistraction: ({ durationMs, at }) =>
        setBgNotice({ text: backgroundDistractionMessage(durationMs), key: at }),
    });
    return stop;
  }, []);

  // DONE: end the session, persist it, show the summary.
  //
  // PR3 / L19: task promotion is **no longer automatic here**. The summary
  // screen now hosts the explicit "Mark task done" affordance — finishing a
  // session does not mean the task is done (a 4-hour task with 70-min
  // recommended sessions was being silently consumed). Default keeps the
  // task; the user marks complete on the summary when they actually are.
  const onDone = useCallback(() => {
    const snapshot = endSession(); // returns the in-flight session, then clears it
    if (!snapshot) {
      router.replace('/home');
      return;
    }

    // M4.5 / M4.6: assembly + focus score + overrun + recomputed break all
    // come from one place (services/session/finalize). Local truth is SQLite
    // via saveCompletedSession; the Firestore mirror is fired async with the
    // failure swallowed (offline / signed-out is fine — SQLite already holds
    // the truth).
    const completed = finalizeOnDone(snapshot, Date.now(), CLIENT_VERSION);
    saveCompletedSession(completed);

    // Refresh the Stats screen immediately (S4.1 wiring of M4.3 handoff). Without
    // this the just-completed session wouldn't show up until staleTime (30s).
    queryClient.invalidateQueries({ queryKey: statsKeys.all });

    // End-of-break nudge (S4.2). Fire-and-forget; prompts for notification
    // permission on first use (a session just ended — a deliberate action, not
    // app open). Silent no-op if permission is denied. PR3: useStartSession +
    // /recovery's Skip both cancel this so it never fires mid-Session 2.
    void scheduleBreakReminder(completed.plan.breakMinutes);

    router.replace({
      pathname: '/session-summary',
      params: {
        minutes: String(completed.actualFocusMinutes),
        distractions: String(completed.distractions.length),
        breakMinutes: String(completed.plan.breakMinutes),
        score: String(completed.focusScore),
        // PR3: pass the task identity through so the summary can render the
        // "Mark task done" affordance for THIS task.
        taskId: snapshot.taskId,
        taskTitle: snapshot.task.title,
      },
    });
  }, [endSession]);

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
        {/* M4.9 / L16: suggested-stop progress + overrun affordance. NOT a phase
            pill flip — phases.ts stays "Flow" past the suggestion (frozen). */}
        <SuggestedStopMeter
          elapsedSeconds={elapsedSeconds}
          plannedFocusMinutes={plan.focusMinutes}
        />
      </View>

      <View style={styles.controls}>
        <DistractionButton />
        <Button label="DONE" onPress={onDone} />
        {/* M4.8 / L16: understated end-early — visually subordinate to DONE,
            never reads as the success path. Opens the Save/Discard sheet. */}
        <Button
          label="End early"
          variant="ghost"
          size="md"
          onPress={() => setEndEarlyOpen(true)}
        />
      </View>

      <EndEarlySheet
        visible={endEarlyOpen}
        onDismiss={() => setEndEarlyOpen(false)}
      />

      <SessionToast
        message={bgNotice?.text ?? null}
        nonce={bgNotice?.key}
        onDismiss={dismissNotice}
        topOffset={insets.top + 8}
      />
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
