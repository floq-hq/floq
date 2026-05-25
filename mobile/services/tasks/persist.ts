// Task-queue persistence (M2.5).
//
// W2: MMKV is the synchronous source of truth — one atomic JSON blob under
// `floq.tasks` (mirrors the onboarding pattern in services/onboarding/persist.ts).
// Writes are sync so queue mutations stay snappy; there is no Firestore mirror in
// W2 (that is M4.2/W4, which will add a fire-and-forget async mirror WITHOUT
// changing these signatures or the store API). React-free.

import { createMMKV } from 'react-native-mmkv';
import type { Task } from './types';

export const TASKS_KEY = 'floq.tasks';

const storage = createMMKV();

/** Persist the whole queue as one atomic blob. Synchronous; never half-written. */
export function saveTasks(tasks: Task[]): void {
  storage.set(TASKS_KEY, JSON.stringify(tasks));
}

/** Read the queue. Returns [] on a fresh install or a corrupt/unparseable blob. */
export function loadTasks(): Task[] {
  const raw = storage.getString(TASKS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Task[]) : [];
  } catch {
    // Corrupt blob — treat as empty rather than crash the queue.
    return [];
  }
}

/** Clear the persisted queue (store reset / sign-out). LLM cache untouched (L13). */
export function clearTasks(): void {
  storage.remove(TASKS_KEY);
}
