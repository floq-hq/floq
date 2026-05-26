import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { ParsedTask, Task } from '../../services/tasks';

// Mock ONLY the persistence submodule (the I/O boundary). The pure queue logic
// stays real so we test the store's wiring end-to-end. The barrel re-exports the
// mocked persist, so the store picks up these spies.
const { saveTasks, loadTasks, clearTasks } = vi.hoisted(() => ({
  saveTasks: vi.fn(),
  loadTasks: vi.fn((): Task[] => []),
  clearTasks: vi.fn(),
}));

vi.mock('../../services/tasks/persist', () => ({
  TASKS_KEY: 'floq.tasks',
  saveTasks,
  loadTasks,
  clearTasks,
}));

import { useTaskStore, selectTopTask, selectHiddenCount } from '../useTaskStore';

const parsed = (title: string, difficulty: 1 | 2 | 3 | 4 | 5, estMinutes: number): ParsedTask => ({
  title,
  difficulty,
  estMinutes,
});

beforeEach(() => {
  vi.clearAllMocks();
  loadTasks.mockReturnValue([]);
  useTaskStore.setState({ tasks: [], hydrated: false });
});

describe('hydrate', () => {
  it('loads tasks from persistence and flips hydrated', async () => {
    loadTasks.mockReturnValue([
      { id: 'a', title: 'A', difficulty: 3, estMinutes: 30, order: 0, done: false, createdAt: 1 },
    ]);
    await useTaskStore.getState().hydrate();
    expect(loadTasks).toHaveBeenCalledTimes(1);
    expect(useTaskStore.getState().tasks.map((t) => t.id)).toEqual(['a']);
    expect(useTaskStore.getState().hydrated).toBe(true);
  });
});

describe('create', () => {
  it('addTask appends a single task, assigns order, and persists', () => {
    useTaskStore.getState().addTask({ title: 'Write report', difficulty: 4, estMinutes: 50 });
    const { tasks } = useTaskStore.getState();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ title: 'Write report', difficulty: 4, estMinutes: 50, order: 0, done: false });
    expect(typeof tasks[0].id).toBe('string');
    expect(saveTasks).toHaveBeenCalledWith(tasks);
  });

  it('addTasks batch-inserts ParsedTask[] preserving order, with unique ids', () => {
    useTaskStore.getState().addTasks([parsed('one', 2, 20), parsed('two', 3, 30), parsed('three', 1, 10)]);
    const { tasks } = useTaskStore.getState();
    expect(tasks.map((t) => t.title)).toEqual(['one', 'two', 'three']);
    expect(tasks.map((t) => t.order)).toEqual([0, 1, 2]);
    expect(new Set(tasks.map((t) => t.id)).size).toBe(3); // ids are unique
    expect(saveTasks).toHaveBeenLastCalledWith(tasks);
  });
});

describe('read selectors', () => {
  it('selectTopTask / selectHiddenCount reflect the queue', () => {
    useTaskStore.getState().addTasks([parsed('a', 3, 30), parsed('b', 3, 30), parsed('c', 3, 30)]);
    const state = useTaskStore.getState();
    expect(selectTopTask(state)!.title).toBe('a');
    expect(selectHiddenCount(state)).toBe(2);
  });

  it('selectTopTask is null and hiddenCount 0 when empty', () => {
    const state = useTaskStore.getState();
    expect(selectTopTask(state)).toBeNull();
    expect(selectHiddenCount(state)).toBe(0);
  });
});

describe('update', () => {
  it('updateTask edits fields and persists', () => {
    useTaskStore.getState().addTask({ title: 'old', difficulty: 1, estMinutes: 10 });
    const id = useTaskStore.getState().tasks[0].id;
    useTaskStore.getState().updateTask(id, { title: 'new', difficulty: 5 });
    const t = useTaskStore.getState().tasks[0];
    expect(t).toMatchObject({ title: 'new', difficulty: 5, estMinutes: 10 });
    expect(saveTasks).toHaveBeenLastCalledWith(useTaskStore.getState().tasks);
  });

  it('reorder moves by order index and persists', () => {
    useTaskStore.getState().addTasks([parsed('a', 3, 30), parsed('b', 3, 30), parsed('c', 3, 30)]);
    useTaskStore.getState().reorder(0, 2);
    expect(useTaskStore.getState().tasks.map((t) => t.title)).toEqual(['b', 'c', 'a']);
    expect(saveTasks).toHaveBeenLastCalledWith(useTaskStore.getState().tasks);
  });

  it('markDone removes the top task and auto-promotes the next', () => {
    useTaskStore.getState().addTasks([parsed('a', 3, 30), parsed('b', 3, 30)]);
    const topId = selectTopTask(useTaskStore.getState())!.id;
    useTaskStore.getState().markDone(topId);
    const { tasks } = useTaskStore.getState();
    expect(tasks.map((t) => t.title)).toEqual(['b']);
    expect(selectTopTask(useTaskStore.getState())!.title).toBe('b');
    expect(saveTasks).toHaveBeenLastCalledWith(tasks);
  });
});

describe('delete', () => {
  it('removeTask deletes by id and persists', () => {
    useTaskStore.getState().addTasks([parsed('a', 3, 30), parsed('b', 3, 30)]);
    const bId = useTaskStore.getState().tasks[1].id;
    useTaskStore.getState().removeTask(bId);
    expect(useTaskStore.getState().tasks.map((t) => t.title)).toEqual(['a']);
    expect(saveTasks).toHaveBeenLastCalledWith(useTaskStore.getState().tasks);
  });
});

describe('reset', () => {
  it('clears persistence and empties the store', () => {
    useTaskStore.getState().addTask({ title: 'a', difficulty: 3, estMinutes: 30 });
    useTaskStore.getState().reset();
    expect(clearTasks).toHaveBeenCalledTimes(1);
    expect(useTaskStore.getState().tasks).toEqual([]);
    expect(useTaskStore.getState().hydrated).toBe(false);
  });
});
