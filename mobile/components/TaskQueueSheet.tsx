/**
 * Task queue management sheet (S2.6). Opened from Home's "+N hidden" caption.
 * Full queue with edit (tap → ManualTaskForm), delete (swipe), reorder (drag),
 * plus an understated manual-add — all routed through useTaskStore (M2.5).
 *
 * The list is the shared DraggableTaskList (also used by the brain-dump review),
 * so reorder/delete behave identically everywhere. Manual add is FIRST-CLASS but
 * deliberately low-prominence (decisions.md L14) — a quiet "+ Add manually".
 */
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './ui';
import { DraggableTaskList } from './DraggableTaskList';
import { ManualTaskForm } from './ManualTaskForm';
import { useTaskStore } from '../stores/useTaskStore';
import type { AddTaskInput, Task, TaskPatch } from '../services/tasks';
import { useTheme } from '../theme';

type FormState = { mode: 'add' } | { mode: 'edit'; task: Task } | null;

export function TaskQueueSheet({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const tasks = useTaskStore((s) => s.tasks);
  const addTask = useTaskStore((s) => s.addTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const removeTask = useTaskStore((s) => s.removeTask);
  const reorder = useTaskStore((s) => s.reorder);
  const [form, setForm] = useState<FormState>(null);

  const onSubmitForm = (input: AddTaskInput) => {
    if (form?.mode === 'edit') {
      const patch: TaskPatch = {
        title: input.title,
        estMinutes: input.estMinutes,
        difficulty: input.difficulty,
      };
      updateTask(form.task.id, patch);
    } else {
      addTask(input);
    }
    setForm(null);
  };

  // --- Edit / add form ---
  if (form) {
    const editing = form.mode === 'edit';
    return (
      <View style={[styles.root, padding(insets)]}>
        <View style={styles.header}>
          <Text variant="heading">{editing ? 'Edit task' : 'Add task'}</Text>
          <Pressable onPress={() => setForm(null)} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back to list">
            <Text variant="heading" color={theme.textMuted}>
              ✕
            </Text>
          </Pressable>
        </View>
        <View style={styles.formBody}>
          <ManualTaskForm
            initial={
              editing
                ? { title: form.task.title, estMinutes: form.task.estMinutes, difficulty: form.task.difficulty }
                : undefined
            }
            submitLabel={editing ? 'Save' : 'Add task'}
            onSubmit={onSubmitForm}
          />
        </View>
      </View>
    );
  }

  // --- List ---
  return (
    <View style={[styles.root, padding(insets)]}>
      <View style={styles.header}>
        <Text variant="heading">Your tasks</Text>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Text variant="heading" color={theme.textMuted}>
            ✕
          </Text>
        </Pressable>
      </View>

      {tasks.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="body" color={theme.textMuted} style={styles.center}>
            No tasks yet — brain-dump, or add one below.
          </Text>
        </View>
      ) : (
        <DraggableTaskList
          items={tasks}
          onReorder={reorder}
          onRemove={(t) => removeTask(t.id)}
          onEdit={(t) => setForm({ mode: 'edit', task: t })}
        />
      )}

      {/* Understated manual-add (L14) — quiet, not competing with brain-dump. */}
      <Pressable
        onPress={() => setForm({ mode: 'add' })}
        style={styles.addManually}
        accessibilityRole="button"
        accessibilityLabel="Add a task manually"
      >
        <Text variant="label" color={theme.textMuted}>
          + Add manually
        </Text>
      </Pressable>
    </View>
  );
}

const padding = (insets: { top: number; bottom: number }) => ({
  paddingTop: Math.max(insets.top, 16),
  paddingBottom: insets.bottom + 16,
});

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  formBody: { flex: 1 },
  addManually: { alignSelf: 'center', paddingVertical: 14 },
});
