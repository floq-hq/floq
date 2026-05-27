// Async Firestore mirror for the task queue (M4.2).
//
// One-way push: SQLite is the source of truth (services/storage/tasks.ts); this
// reflects each local change to users/{uid}/tasks/{taskId} (owner-only; the
// M2.2 rule `users/{uid}/{document=**}` already authorizes it). Diff-based — no
// Firestore read, no destructive full-collection wipe: upsert the current queue,
// delete only the ids that were removed since the previous queue. Task titles
// are owner-only here and never reach the social doc (L4 privacy invariant).
//
// Fire-and-forget: a failed mirror must never lose the local write or surface in
// the UI. True two-way reconciliation (Firestore→SQLite) is a later milestone.

import { doc, Timestamp, writeBatch } from 'firebase/firestore';
import { auth } from '../firebase/auth';
import { db } from '../firebase/init';
import type { Task } from './types';

function taskDoc(uid: string, id: string) {
  return doc(db, 'users', uid, 'tasks', id);
}

/**
 * Mirror the queue transition `prev → next` to Firestore in one batch.
 * No-ops when signed out (local SQLite stays authoritative; reconcile on next
 * signed-in sync). Rejects only on a Firestore write error — callers fire this
 * and swallow.
 */
export async function mirrorTasks(prev: Task[], next: Task[]): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const batch = writeBatch(db);

  for (const t of next) {
    batch.set(taskDoc(uid, t.id), {
      id: t.id,
      title: t.title,
      difficulty: t.difficulty,
      est_minutes: t.estMinutes,
      order: t.order,
      done: t.done,
      created_at: Timestamp.fromMillis(t.createdAt),
    });
  }

  const nextIds = new Set(next.map((t) => t.id));
  for (const t of prev) {
    if (!nextIds.has(t.id)) batch.delete(taskDoc(uid, t.id));
  }

  await batch.commit();
}
