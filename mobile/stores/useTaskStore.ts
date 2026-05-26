// Task store (M2.5) — the in-app source of truth for the user-task queue.
//
// Follows the house pattern set by useOnboardingStore: NO zustand `persist`
// middleware. MMKV is our synchronous source of truth and persistence is
// explicit via services/tasks/persist. The store is the React facade and the
// IMPURE boundary — it mints id/createdAt and delegates all array math to the
// pure services/tasks/queue, then write-through persists. The store imports the
// service; never the reverse.
//
// API is stable across the W4 swap (M4.2): SQLite becomes the source of truth
// and MMKV demotes to a cache, but these action/selector signatures don't change.

import { create } from 'zustand';
import {
  clearTasks,
  hiddenCount,
  insert,
  insertMany,
  loadTasks,
  markDone as queueMarkDone,
  removeTask as queueRemoveTask,
  reorder as queueReorder,
  saveTasks,
  topTask,
  updateTask as queueUpdateTask,
  type AddTaskInput,
  type ParsedTask,
  type Task,
  type TaskPatch,
} from '../services/tasks';

interface TaskState {
  /** The active queue, kept sorted by `order` (0 = visible/top task). */
  tasks: Task[];
  /** True once hydrate() has run (lets the UI avoid a flash before load). */
  hydrated: boolean;

  hydrate: () => Promise<void>;
  addTasks: (parsed: ParsedTask[]) => void; // LLM brain-dump batch
  addTask: (input: AddTaskInput) => void; // single manual entry
  updateTask: (id: string, patch: TaskPatch) => void;
  reorder: (fromOrder: number, toOrder: number) => void;
  markDone: (id: string) => void; // drops + auto-promotes next (W2)
  removeTask: (id: string) => void;
  reset: () => void;
}

/** Dependency-free local id (no uuid/nanoid dep; crypto.randomUUID isn't
 *  reliably present in Hermes). Collision risk is negligible for a local queue. */
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

/** Mint a full Task from a creation input. order is a placeholder — insert/
 *  insertMany renumber it into the queue. */
function buildTask(input: AddTaskInput): Task {
  return {
    id: genId(),
    title: input.title,
    difficulty: input.difficulty,
    estMinutes: input.estMinutes,
    order: 0,
    done: false,
    createdAt: Date.now(),
  };
}

export const useTaskStore = create<TaskState>((set, get) => {
  // Apply a pure transform to the current queue, persist, and commit to state.
  const commit = (next: Task[]) => {
    saveTasks(next);
    set({ tasks: next });
  };

  return {
    tasks: [],
    hydrated: false,

    hydrate: async () => {
      set({ tasks: loadTasks(), hydrated: true });
    },

    addTasks: (parsed) => commit(insertMany(get().tasks, parsed.map(buildTask))),
    addTask: (input) => commit(insert(get().tasks, buildTask(input))),
    updateTask: (id, patch) => commit(queueUpdateTask(get().tasks, id, patch)),
    reorder: (fromOrder, toOrder) => commit(queueReorder(get().tasks, fromOrder, toOrder)),
    markDone: (id) => commit(queueMarkDone(get().tasks, id)),
    removeTask: (id) => commit(queueRemoveTask(get().tasks, id)),

    reset: () => {
      clearTasks();
      set({ tasks: [], hydrated: false });
    },
  };
});

/** Selectors (drive Home's "one visible / +N hidden"). Use with the store:
 *  `const top = useTaskStore(selectTopTask);` */
export const selectTopTask = (s: TaskState): Task | null => topTask(s.tasks);
export const selectHiddenCount = (s: TaskState): number => hiddenCount(s.tasks);
