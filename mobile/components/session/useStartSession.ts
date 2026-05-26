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
import type { Task } from '../../services/tasks';

export function useStartSession(topTask: Task | null) {
  const [launching, setLaunching] = useState(false);
  const [showIntro, setShowIntro] = useState(false);

  // Returning from a session refocuses the screen — re-enable START.
  useFocusEffect(useCallback(() => setLaunching(false), []));

  const launch = useCallback(() => {
    if (!topTask || launching) return;
    setLaunching(true);
    setTimeout(() => {
      try {
        const plan = computeSessionPlan(topTask.id);
        router.push({
          pathname: '/focus',
          params: { taskId: topTask.id, plan: JSON.stringify(plan) },
        });
      } catch (err) {
        if (__DEV__) console.warn('[session] failed to start session', err);
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

  return { onStart, launching, showIntro, onIntroDismiss };
}
