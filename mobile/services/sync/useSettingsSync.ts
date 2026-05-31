// Cross-device settings sync wiring (W6-sweep).
//
// Mounts the real-time pull-down for the life of a signed-in session: on a present
// uid it subscribes to the user's remote settings and adopts them locally IFF the
// remote is newer than what we have (whole-blob last-write-wins, like useTaskSync).
// Tears down on sign-out / uid change. Mounted once under the authed tab tree
// (app/(tabs)/_layout), alongside useSessionSync.
//
// Loop-safe: subscribeRemoteSettings skips local-pending snapshots, and applyRemote
// persists via the no-mirror path — so a pulled blob never re-triggers the
// up-mirror. A listener error is dev-logged only; sync is best-effort over the
// local MMKV truth and never blocks the app.

import { useEffect } from 'react';
import { useCurrentUser } from '../firebase';
import { subscribeRemoteSettings } from '../settings/settingsSync';
import { loadSettingsUpdatedAt } from '../settings/persist';
import { useSettingsStore } from '../../stores/useSettingsStore';

export function useSettingsSync(): void {
  const { user } = useCurrentUser();
  const uid = user?.uid;

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = subscribeRemoteSettings(
      uid,
      (settings, updatedAtMs) => {
        // Last-write-wins: adopt the remote blob only when it's strictly newer.
        if (updatedAtMs > loadSettingsUpdatedAt()) {
          useSettingsStore.getState().applyRemote(settings, updatedAtMs);
        }
      },
      (error) => {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[sync] remote settings listener error', error);
        }
      },
    );
    return unsubscribe;
  }, [uid]);
}
