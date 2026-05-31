// Cross-device task-queue sync — the PULL-DOWN half (last-write-wins, whole queue).
//
// The queue already mirrors UP to users/{uid}/tasks/{taskId} (firestoreMirror).
// This adds the read-back: a real-time onSnapshot listener that hands the remote
// queue + its last-mutation time to a callback, which applies it locally IFF the
// remote is newer (LWW). The queue is MUTABLE (unlike immutable sessions), so the
// merge unit is the WHOLE queue — the most-recently-saved device wins entirely
// (Mohamed's chosen policy). Inherent trade-off: an edit on the losing device is
// overwritten; acceptable for one user on two devices not editing simultaneously.
//
// Owner-only own-data sync (M2.2 rule) — no rules change. fromTaskDoc mirrors the
// write shape in firestoreMirror's taskDoc.

import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/init';
import type { Task } from './types';

/** A Firestore Timestamp (or already-ms number / pending null) → epoch ms (0 if
 *  absent — e.g. a legacy task doc written before updated_at existed). */
function toMs(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

/** Reverse of firestoreMirror's taskDoc write: a tasks/{id} doc → Task. */
export function fromTaskDoc(d: Record<string, unknown>): Task {
  return {
    id: String(d.id),
    title: typeof d.title === 'string' ? d.title : '',
    difficulty: (d.difficulty ?? 3) as Task['difficulty'],
    estMinutes: Number(d.est_minutes ?? 0),
    order: Number(d.order ?? 0),
    done: Boolean(d.done),
    createdAt: toMs(d.created_at),
  };
}

/** Last-mutation time of a remote queue = the max updated_at across its docs.
 *  0 for an empty queue or all-legacy docs (no updated_at) — which never beats a
 *  real local timestamp, so legacy data can't clobber. */
export function queueUpdatedAtMs(docs: Record<string, unknown>[]): number {
  let max = 0;
  for (const d of docs) {
    const ms = toMs(d.updated_at);
    if (ms > max) max = ms;
  }
  return max;
}

/**
 * Subscribe to the signed-in user's task queue in real time. onSnapshot fires an
 * initial snapshot on subscribe (a fresh device gets the queue at once) then live
 * deltas. Skips local-pending snapshots (`hasPendingWrites`) so a device never
 * reacts to its own optimistic write before the server resolves `updated_at` —
 * the callback only ever sees server-confirmed state. Returns the unsubscribe
 * handle. Tasks arrive sorted by `order`.
 */
export function subscribeRemoteTasks(
  uid: string,
  onTasks: (tasks: Task[], updatedAtMs: number) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'tasks'),
    (snap) => {
      if (snap.metadata.hasPendingWrites) return; // ignore our own optimistic echo
      const data = snap.docs.map((doc) => doc.data() as Record<string, unknown>);
      const tasks = data.map(fromTaskDoc).sort((a, b) => a.order - b.order);
      onTasks(tasks, queueUpdatedAtMs(data));
    },
    (error) => onError?.(error),
  );
}
