// Cross-device task-queue sync wiring (last-write-wins, whole queue).
//
// Mounts the real-time pull-down for the life of a signed-in session: on a
// present uid it subscribes to the user's remote queue and applies it locally
// IFF the remote is newer than what we have (LWW). Tears down on sign-out / uid
// change. Mounted once under the authed tab tree (app/(tabs)/_layout), alongside
// useSessionSync.
//
// Loop-safe: subscribeRemoteTasks skips local-pending snapshots, and applyRemote
// persists via the no-mirror path — so a pulled queue never re-triggers the
// up-mirror. A listener error (network blip) is dev-logged only; sync is
// best-effort over the local SQLite truth and never blocks the app.

import { useEffect } from 'react';
import { useCurrentUser } from '../firebase';
import { subscribeRemoteTasks } from '../tasks/taskSync';
import { loadQueueUpdatedAt } from '../tasks';
import { useTaskStore } from '../../stores/useTaskStore';

export function useTaskSync(): void {
  const { user } = useCurrentUser();
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = subscribeRemoteTasks(
      uid,
      (tasks, updatedAtMs) => {
        // Last-write-wins: only adopt the remote queue when it's strictly newer
        // than the local one. Our own server-confirmed echo (remote === local,
        // newer server ms) harmlessly re-applies the same data and advances the
        // local LWW clock to the authoritative server time.
        if (updatedAtMs > loadQueueUpdatedAt()) {
          useTaskStore.getState().applyRemote(tasks, updatedAtMs);
        }
      },
      (error) => {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[sync] remote task listener error', error);
        }
      },
    );
    return unsubscribe;
  }, [uid]);
}
