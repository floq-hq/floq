// SQLite task CRUD (M4.2) — the durable source of truth for the task queue.
//
// MMKV (services/tasks/persist.ts) is a fast-read cache layered ABOVE this; the
// Firestore mirror is layered async beside it. These functions are the only
// place that touches the tasks table. Synchronous (expo-sqlite sync API): task
// mutations are user-paced, never on the timer tick path. No React.

import { getDb } from '../../models/db';
import type { Task } from '../tasks/types';

interface TaskRow {
  id: string;
  title: string;
  difficulty: number;
  est_minutes: number;
  order: number;
  done: number;
  created_at: number;
}

function rowToTask(r: TaskRow): Task {
  return {
    id: r.id,
    title: r.title,
    difficulty: r.difficulty as Task['difficulty'],
    estMinutes: r.est_minutes,
    order: r.order,
    done: r.done === 1,
    createdAt: r.created_at,
  };
}

/** Replace the whole queue in one transaction. The store always hands over the
 *  full, renumbered array (services/tasks/queue.ts), so replace-all keeps SQLite
 *  exactly in sync with no stale rows. */
export function upsertQueue(tasks: Task[]): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM tasks');
    for (const t of tasks) {
      db.runSync(
        'INSERT INTO tasks (id, title, difficulty, est_minutes, "order", done, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        t.id,
        t.title,
        t.difficulty,
        t.estMinutes,
        t.order,
        t.done ? 1 : 0,
        t.createdAt,
      );
    }
  });
}

/** Read the queue from SQLite, sorted by queue position. */
export function readAllTasks(): Task[] {
  return getDb()
    .getAllSync<TaskRow>('SELECT * FROM tasks ORDER BY "order" ASC')
    .map(rowToTask);
}

/** How many tasks are persisted (used to gate the one-time MMKV→SQLite import). */
export function countTasks(): number {
  const row = getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM tasks');
  return row?.n ?? 0;
}

/** Remove every task (sign-out teardown / store reset). */
export function deleteAllTasks(): void {
  getDb().runSync('DELETE FROM tasks');
}
