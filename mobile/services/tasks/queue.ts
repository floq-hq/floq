// Pure queue logic for the task feature (M2.5).
//
// ZERO React imports. Deterministic: no Date.now(), no id generation here — the
// store (stores/useTaskStore.ts) owns those impure concerns and hands fully-formed
// Tasks to these transforms. That keeps this module trivially unit-testable and
// lets W4 (M4.2) swap the persistence adapter without touching the logic.
//
// Invariant maintained by every transform: the returned array is sorted by
// `order` and `order` is contiguous 0-based (0 = the visible/top task). The W2
// blob only ever holds ACTIVE tasks — markDone drops the completed one (per the
// W2 decision in the plan / task-queue.md "done-history is post-MVP"), so these
// functions never need to filter `done`.

import type { Task, TaskPatch } from './types';

/** Sorted copy by ascending order. */
function sortByOrder(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => a.order - b.order);
}

/** Reassign `order` to match array position (0-based, contiguous). */
function renumber(tasks: Task[]): Task[] {
  return tasks.map((t, i) => (t.order === i ? t : { ...t, order: i }));
}

/** Append a single task to the bottom of the queue, then renumber. */
export function insert(tasks: Task[], task: Task): Task[] {
  return renumber([...sortByOrder(tasks), task]);
}

/** Append a batch (in given order) to the bottom of the queue, then renumber. */
export function insertMany(tasks: Task[], newTasks: Task[]): Task[] {
  return renumber([...sortByOrder(tasks), ...newTasks]);
}

/** Edit the allowed fields of one task. Order/id/done/createdAt are preserved. */
export function updateTask(tasks: Task[], id: string, patch: TaskPatch): Task[] {
  return sortByOrder(tasks).map((t) => (t.id === id ? { ...t, ...patch } : t));
}

/** Move the task at `fromOrder` to `toOrder` (array-move by position), renumber. */
export function reorder(tasks: Task[], fromOrder: number, toOrder: number): Task[] {
  const sorted = sortByOrder(tasks);
  const n = sorted.length;
  if (
    fromOrder < 0 ||
    fromOrder >= n ||
    toOrder < 0 ||
    toOrder >= n ||
    fromOrder === toOrder
  ) {
    return renumber(sorted); // out of range or no-op
  }
  const [moved] = sorted.splice(fromOrder, 1);
  sorted.splice(toOrder, 0, moved);
  return renumber(sorted);
}

/** Remove a task by id and renumber. Unknown id is a no-op (still renumbered). */
export function removeTask(tasks: Task[], id: string): Task[] {
  return renumber(sortByOrder(tasks).filter((t) => t.id !== id));
}

/**
 * Complete a task: in W2 this DROPS it from the active queue and renumbers, so
 * the next task auto-promotes to order 0 (session-flow.md §Task promotion). The
 * `done` flag lives on the Task type for the W4 SQLite history layer. Returns []
 * when the completed task was the last one.
 */
export function markDone(tasks: Task[], id: string): Task[] {
  return removeTask(tasks, id);
}

/** Drop the current top task and promote the next (symmetry with the spec name). */
export function promoteNext(tasks: Task[]): Task[] {
  return renumber(sortByOrder(tasks).slice(1));
}

/** The visible task (order 0), or null when the queue is empty. */
export function topTask(tasks: Task[]): Task | null {
  return sortByOrder(tasks)[0] ?? null;
}

/** How many tasks are hidden behind the visible one (drives Home's "+N hidden"). */
export function hiddenCount(tasks: Task[]): number {
  return Math.max(tasks.length - 1, 0);
}
