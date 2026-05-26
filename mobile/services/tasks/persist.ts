// Task-queue persistence (M2.5; reworked in M4.2).
//
// SQLite is now the durable source of truth (services/storage/tasks.ts); MMKV
// demotes to a synchronous fast-read CACHE of the same `floq.tasks` blob, kept
// for the render path (hydrate reads it sync — no flash, no async). Firestore is
// an async one-way mirror. This module is the facade the task store already
// talks to: the three signatures (saveTasks/loadTasks/clearTasks, all sync) and
// the store's tests are UNCHANGED — only the backing store moved. React-free.

import { createMMKV } from 'react-native-mmkv';
import { mirrorTasks } from './firestoreMirror';
import type { Task } from './types';
import { countTasks, deleteAllTasks, upsertQueue } from '../storage';

export const TASKS_KEY = 'floq.tasks';

const storage = createMMKV();

/** Read the MMKV cache blob. Returns [] on a fresh install or a corrupt blob. */
function readCache(): Task[] {
  const raw = storage.getString(TASKS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Task[]) : [];
  } catch {
    return [];
  }
}

/** Write the whole queue to the MMKV cache as one atomic blob. */
function writeCache(tasks: Task[]): void {
  storage.set(TASKS_KEY, JSON.stringify(tasks));
}

/** One-time backfill: an existing M2.5 user has their queue in the MMKV blob but
 *  nothing in SQLite yet. Import it once so SQLite becomes the source of truth
 *  without data loss. Guarded by DB state (idempotent): no-op once SQLite has
 *  tasks, and a no-op on a fresh install (empty blob). */
function ensureLegacyImport(): void {
  if (countTasks() > 0) return;
  const blob = readCache();
  if (blob.length === 0) return;
  upsertQueue(blob);
}

/** Persist the whole queue. SQLite first (truth), then refresh the cache, then
 *  fire the async Firestore mirror. The mirror never blocks or throws into the
 *  caller; the previous queue is diffed for precise deletes. Synchronous. */
export function saveTasks(tasks: Task[]): void {
  const prev = readCache();
  upsertQueue(tasks); // source of truth — must succeed before the cache is touched
  writeCache(tasks); // fast-read cache, written in lockstep (never drifts)
  void mirrorTasks(prev, tasks).catch(() => {
    // swallowed: SQLite holds the truth; reconcile on a later signed-in sync.
  });
}

/** Read the queue for the render path (hydrate). Reads the sync MMKV cache after
 *  ensuring any legacy blob has been imported into SQLite. */
export function loadTasks(): Task[] {
  ensureLegacyImport();
  return readCache();
}

/** Clear the persisted queue (store reset / sign-out): SQLite + the cache. The
 *  LLM cache (floq.llmCache.*) is intentionally left untouched (decision L13). */
export function clearTasks(): void {
  deleteAllTasks();
  storage.remove(TASKS_KEY);
}
