// Cross-device wipe marker — the small persisted state behind the data-wipe
// tombstone protocol (see useDataWipeSync). Two values in MMKV:
//
//  - dataClearedAt: the server timestamp (epoch ms) of the most recent wipe this
//    device has APPLIED. A remote tombstone newer than this is a wipe we have not
//    enacted locally yet.
//  - selfInitiated: set by the device that TRIGGERS a wipe (wipeRemoteUserData)
//    so when that device's own tombstone echoes back through the listener it just
//    advances the marker WITHOUT re-running the local wipe — which would nuke any
//    session/task created in the seconds right after the clear. One-shot: cleared
//    on first use.
//
// React-free; mirrors the MMKV usage in services/tasks/persist.ts.
import { createMMKV } from 'react-native-mmkv';

const DATA_CLEARED_AT_KEY = 'floq.dataClearedAt';
const WIPE_SELF_INITIATED_KEY = 'floq.dataClearedAt.self';

const storage = createMMKV();

/** Epoch ms of the most recent wipe this device has applied (0 if never). */
export function loadDataClearedAt(): number {
  return storage.getNumber(DATA_CLEARED_AT_KEY) ?? 0;
}

/** Record the wipe this device has now applied, so it is not re-applied. */
export function saveDataClearedAt(ms: number): void {
  storage.set(DATA_CLEARED_AT_KEY, ms);
}

/** Mark that THIS device triggered the next wipe (suppress its own echo). */
export function setWipeSelfInitiated(): void {
  storage.set(WIPE_SELF_INITIATED_KEY, true);
}

/** True if this device triggered the pending wipe. */
export function loadWipeSelfInitiated(): boolean {
  return storage.getBoolean(WIPE_SELF_INITIATED_KEY) ?? false;
}

/** Consume the self-initiated guard (after the echo has been handled). */
export function clearWipeSelfInitiated(): void {
  storage.remove(WIPE_SELF_INITIATED_KEY);
}
