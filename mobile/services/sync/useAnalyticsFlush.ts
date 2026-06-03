// Analytics flush wiring (M7.2). Mirrors useTelemetryFlush, but ALWAYS-ON — there
// is NO consent gate (the gate lives only on the L23 telemetry path). While
// signed in, flushes staged funnel events on mount and whenever the app returns
// to the foreground (a natural retry point for events that failed offline).
// Mounted once under the authed tab tree (app/(tabs)/_layout), beside the sync
// hooks. Best-effort, fire-and-forget.

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useCurrentUser } from '../firebase';
import { flushAnalyticsEvents } from '../analytics/uploadAnalyticsEvents';

export function useAnalyticsFlush(): void {
  const { user } = useCurrentUser();
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return;
    void flushAnalyticsEvents(); // on mount / sign-in
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushAnalyticsEvents();
    });
    return () => sub.remove();
  }, [uid]);
}
