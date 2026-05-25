// Task-queue types (M2.5).
//
// The in-app Task is the source of truth in the store; the Firestore mirror in
// schema.md uses snake_case and lands in W4 (M4.2). See shared/spec/task-queue.md
// + decisions.md L14. Task titles are PRIVATE — they never leave the device to
// friends / social (L4).

import type { ParsedTask } from '../llm';

export type { ParsedTask };

/** 1–5 scale shared with the timer (difficulty) and the LLM parser. */
export type Difficulty = 1 | 2 | 3 | 4 | 5;

export interface Task {
  id: string;
  title: string; // PRIVATE — never synced to friends/social (L4)
  difficulty: Difficulty;
  estMinutes: number;
  order: number; // queue position; lower = higher priority; 0 = top/visible task
  done: boolean; // defaults false
  createdAt: number; // epoch ms
}

/** Manual-entry shape (ManualTaskForm): title + duration + difficulty. */
export type AddTaskInput = Pick<Task, 'title' | 'difficulty' | 'estMinutes'>;

/** Editable fields for updateTask (the CRUD "U: edit fields" row). */
export type TaskPatch = Partial<Pick<Task, 'title' | 'difficulty' | 'estMinutes'>>;
