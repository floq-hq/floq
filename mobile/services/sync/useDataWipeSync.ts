// Cross-device data-wipe listener — the propagation half of "Clear history".
//
// Clearing on one device deletes the cloud mirror AND stamps
// users/{uid}.data_cleared_at (wipeRemoteUserData). The session/task pull-down
// listeners are upsert / last-write-wins only — they cannot represent a deletion,
// so a SECOND signed-in device sees an empty snapshot, keeps its local copy, and
// can even re-push it (resurrecting the data). This listener closes that gap: it
// watches the tombstone and, when a wipe newer than the one this device has
// already applied appears, clears local history here too.
//
// The device that TRIGGERED the wipe set a self-initiated guard, so its own echo
// only advances the marker (no second local wipe over data created right after
// the clear). Mounted once under the authed tab tree, beside useSessionSync.
//
// A listener error (network blip) is dev-logged only — sync is best-effort over
// the local SQLite truth and never blocks the app.

import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '../firebase';
import { subscribeDataCleared } from '../firebase/userData';
import { decideWipeAction } from './wipeDecision';
import { wipeLocalData } from './localWipe';
import {
  clearWipeSelfInitiated,
  loadDataClearedAt,
  loadWipeSelfInitiated,
  saveDataClearedAt,
} from './wipeMarker';
import { statsKeys } from '../stats/useStats';

export function useDataWipeSync(): void {
  const { user } = useCurrentUser();
  const uid = user?.uid;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!uid) return;
    return subscribeDataCleared(
      uid,
      (remoteMs) => {
        const action = decideWipeAction({
          remoteMs,
          appliedMs: loadDataClearedAt(),
          selfInitiated: loadWipeSelfInitiated(),
        });
        if (action === 'noop') return;
        // 'wipe' = a wipe from another device → enact it locally. 'record' = our
        // own echo → marker only, the clear flow already wiped local.
        if (action === 'wipe') wipeLocalData();
        saveDataClearedAt(remoteMs);
        clearWipeSelfInitiated();
        // Recompute every stats card over the now-empty set (same ['stats']
        // namespace the Done writer + useSessionSync use).
        void queryClient.invalidateQueries({ queryKey: statsKeys.all });
      },
      (error) => {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[sync] data-wipe listener error', error);
        }
      },
    );
  }, [uid, queryClient]);
}
