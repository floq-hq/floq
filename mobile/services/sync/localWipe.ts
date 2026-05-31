// The local half of a data wipe — clear every on-device store the user's history
// lives in: SQLite sessions + the anonymized training outbox, and the task queue
// (Zustand + its SQLite/MMKV backing, via the store's reset). Shared by the
// cross-device wipe listener (useDataWipeSync) so a wipe triggered on ANOTHER
// device clears exactly what the originating Clear-history flow clears locally.
//
// NB: training_samples already uploaded are NOT touched (anonymized + unlinkable
// by design, L23) — this only clears the local outbox, same as the data screen.
import { deleteAllSessions } from '../storage/sessions';
import { deleteAllTrainingSamples } from '../storage/trainingOutbox';
import { useTaskStore } from '../../stores/useTaskStore';

/** Clear all local history (sessions, training outbox, task queue). */
export function wipeLocalData(): void {
  deleteAllSessions();
  deleteAllTrainingSamples();
  useTaskStore.getState().reset();
}
