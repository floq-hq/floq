/**
 * Shared "start a focus session" flow. Used by both entry points — Home's START
 * SESSION and the Session tab's launchpad — so the behavior can't drift.
 *
 * Computes the plan AT start (computeSessionPlan, M3.3; CLAUDE.md: "recompute at
 * session start"), gates the one-time framing card (S2.5), then hands off to the
 * full-screen /focus route with { taskId, plan }. The compute is synchronous, so
 * we defer a frame behind a `launching` flag: the loading state paints and a
 * thrown invariant stays out of the press handler.
 *
 * Caller owns the top-task subscription and passes it in (one store subscription
 * per screen) and renders <FirstSessionFramingCard visible={showIntro}
 * onDismiss={onIntroDismiss} />.
 */
import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { getHasSeenIntro } from '../../services/intro/seen';
import { computeSessionPlan } from '../../services/session/compute';
import { cancelBreakReminder } from '../../services/notifications';
import type { Task } from '../../services/tasks';

export function useStartSession(topTask: Task | null) {
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(false);

  // Returning from a session refocuses the screen — re-enable START and clear
  // any stale launch error (a previous failure shouldn't sit forever).
  useFocusEffect(
    useCallback(() => {
      setLaunching(false);
      setLaunchError(null);
    }, []),
  );

  const launch = useCallback(() => {
    if (!topTask || launching) return;
    setLaunching(true);
    setLaunchError(null);
    // Cancel any pending end-of-break notification — the user is starting again
    // before the break ended (L17: skippable recovery), so "Recovery's almost
    // up" mid-Session 2 would be noise. Fire-and-forget; never blocks the start.
    void cancelBreakReminder();
    setTimeout(() => {
      try {
        const plan = computeSessionPlan(topTask.id);
        router.push({
          pathname: '/focus',
          params: { taskId: topTask.id, plan: JSON.stringify(plan) },
        });
      } catch (err) {
        // PR4 (audit Finding #4) — previously the catch logged in dev and
        // silently swallowed in prod, leaving the START button stuck on
        // "launching" forever. Now we surface a one-line caption next to
        // START so the user knows what went wrong (and the button re-enables).
        if (__DEV__) console.warn('[session] failed to start session', err);
        const message =
          err instanceof Error && /onboarding/i.test(err.message)
            ? 'Finish onboarding to start a session.'
            : err instanceof Error && /no task found/i.test(err.message)
              ? 'Your top task is gone — pick another or brain-dump a new one.'
              : 'Couldn’t start a session. Try again.';
        setLaunchError(message);
        setLaunching(false);
      }
    }, 0);
  }, [topTask, launching]);

  // Show the framing card once before the very first session, then launch; skip
  // straight to launch afterwards.
  const onStart = useCallback(() => {
    if (getHasSeenIntro()) launch();
    else setShowIntro(true);
  }, [launch]);
  const onIntroDismiss = useCallback(() => {
    setShowIntro(false);
    launch();
  }, [launch]);

  return { onStart, launching, launchError, showIntro, onIntroDismiss };
}
