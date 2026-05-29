/**
 * Manual task entry (S2.4). Title + duration picker + difficulty — produces one
 * `AddTaskInput`. Per task-queue.md this is a FIRST-CLASS path, not just an
 * LLM-failure fallback: S2.4 uses it as the failure path, and S2.6 reuses the
 * very same component for the understated first-class manual add (and for edit,
 * via `initial`).
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, SegmentedControl, Slider, Text, TextField, type SegmentedControlOption } from './ui';
import { useTheme } from '../theme';
import type { AddTaskInput, Difficulty } from '../services/tasks';

const DIFFICULTY_OPTIONS: SegmentedControlOption<Difficulty>[] = (
  [1, 2, 3, 4, 5] as Difficulty[]
).map((n) => ({ label: String(n), value: n }));

export function ManualTaskForm({
  initial,
  submitLabel = 'Add task',
  onSubmit,
}: {
  /** Prefill for edit reuse (S2.6); omitted for a fresh add. */
  initial?: AddTaskInput;
  submitLabel?: string;
  onSubmit: (input: AddTaskInput) => void;
}) {
  const theme = useTheme();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [estMinutes, setEstMinutes] = useState(initial?.estMinutes ?? 25);
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? 3);
  const trimmed = title.trim();

  return (
    <View style={styles.root}>
      <TextField
        label="Task"
        placeholder="What needs doing?"
        value={title}
        onChangeText={setTitle}
        autoFocus
        returnKeyType="done"
        // PR5 (audit Finding #22): clamp at 200 to match the LLM schema's
        // zod max — prevents paste-bombs and keeps stored titles within
        // what every UI surface (Home, Stats, summary) can render.
        maxLength={200}
      />

      <View style={styles.field}>
        <View style={styles.rowBetween}>
          <Text variant="label" color={theme.textMuted}>
            Estimated time
          </Text>
          <Text variant="label">{estMinutes} min</Text>
        </View>
        <Slider
          value={estMinutes}
          onValueChange={setEstMinutes}
          minimumValue={5}
          maximumValue={120}
          step={5}
        />
      </View>

      <View style={styles.field}>
        <Text variant="label" color={theme.textMuted}>
          Difficulty
        </Text>
        <SegmentedControl options={DIFFICULTY_OPTIONS} value={difficulty} onChange={setDifficulty} />
      </View>

      <Button
        label={submitLabel}
        disabled={trimmed.length === 0}
        onPress={() => onSubmit({ title: trimmed, estMinutes, difficulty })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 20 },
  field: { gap: 8 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
