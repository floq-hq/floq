// Cross-device session sync wiring (sessions first).
//
// Mounts the real-time pull-down listener for the life of a signed-in session:
// on a present uid it subscribes to the user's remote sessions, upserts them into
// local SQLite (the durable source of truth), and invalidates the stats queries so
// the UI recomputes over the merged set. Tears the listener down on sign-out / uid
// change. Mounted once under the authed tab tree (app/(tabs)/_layout).
//
// A listener error (network blip) is swallowed in dev-log only — sync is
// best-effort over the local SQLite truth; it never blocks the app.

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '../firebase';
import { subscribeRemoteSessions } from '../firebase/sessionSync';
import { upsertRemoteSessions } from '../storage/sessions';
import { statsKeys } from '../stats/useStats';

export function useSessionSync(): void {
  const { user } = useCurrentUser();
  const uid = user?.uid;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = subscribeRemoteSessions(
      uid,
      (sessions) => {
        upsertRemoteSessions(sessions);
        // Recompute every stats card (weekly score, streak, forecast, …) over the
        // newly-merged session set. Same ['stats'] namespace the Done writer uses.
        void queryClient.invalidateQueries({ queryKey: statsKeys.all });
      },
      (error) => {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[sync] remote session listener error', error);
        }
      },
    );
    return unsubscribe;
  }, [uid, queryClient]);
}
