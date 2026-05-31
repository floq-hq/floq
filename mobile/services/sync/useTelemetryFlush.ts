// ML telemetry flush wiring (L23 egress).
//
// While signed in, flushes settled training samples on mount and whenever the app
// returns to the foreground (AppState → active) — the moments staged samples have
// likely settled (task_completed resolved, grace window passed). The consent gate
// lives inside flushTrainingSamples (no-op when telemetryConsent is OFF), so this
// hook just drives the cadence. Mounted once under the authed tab tree
// (app/(tabs)/_layout), beside the sync hooks. Best-effort, fire-and-forget.

import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useCurrentUser } from '../firebase';
import { flushTrainingSamples } from '../telemetry/uploadTrainingSamples';

export function useTelemetryFlush(): void {
  const { user } = useCurrentUser();
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return;
    void flushTrainingSamples(); // on mount / sign-in
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void flushTrainingSamples();
    });
    return () => sub.remove();
  }, [uid]);
}
