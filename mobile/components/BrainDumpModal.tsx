/**
 * Brain-dump modal (S2.4). Free-text capture → parseTasks() → review the parsed
 * list and save, with a manual-entry fallback when parsing fails. The two
 * creation paths from task-queue.md: LLM brain-dump (here) and ManualTaskForm
 * (shown on failure; reused first-class in S2.6).
 *
 * parseTasks validates every provider response with zod before it reaches this
 * UI (CLAUDE.md), so `parsed` is always well-formed. Save persists via
 * useTaskStore.addTasks (M2.5; SQLite mirror lands in W4).
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from './ui';
import { ParsedTaskList } from './ParsedTaskList';
import { ManualTaskForm } from './ManualTaskForm';
import { parseTasks, type ParseFailReason, type ParsedTask } from '../services/llm';
import { useTaskStore } from '../stores/useTaskStore';
import { useOnboardingStore } from '../stores/useOnboardingStore';
import type { AddTaskInput } from '../services/tasks';
import { useTheme } from '../theme';

type Mode = 'input' | 'loading' | 'review' | 'manual';

function noticeFor(reason: ParseFailReason): string {
  switch (reason) {
    case 'rate_limited':
      return 'We’re a bit busy right now — add a task manually for the moment.';
    case 'parse_failed':
      return 'Couldn’t read that into tasks — add one manually.';
    case 'unavailable':
      return 'Task organizing is offline — add one manually.';
  }
}

export function BrainDumpModal({ onClose }: { onClose: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const useCase = useOnboardingStore((s) => s.answers?.use_case) ?? 'work';
  const addTasks = useTaskStore((s) => s.addTasks);
  const addTask = useTaskStore((s) => s.addTask);

  const [mode, setMode] = useState<Mode>('input');
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedTask[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  async function onOrganize() {
    const input = text.trim();
    if (!input) return;
    setMode('loading');
    const res = await parseTasks(input, useCase);
    if (res.ok) {
      setParsed(res.tasks);
      setMode('review');
    } else {
      setNotice(noticeFor(res.reason));
      setMode('manual');
    }
  }

  function onSaveParsed() {
    if (parsed.length === 0) return;
    addTasks(parsed);
    onClose();
  }

  function onManualSubmit(input: AddTaskInput) {
    addTask(input);
    onClose();
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text variant="heading">Brain-dump</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
          <Text variant="heading" color={theme.textMuted}>
            ✕
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {mode === 'input' ? (
          <View style={styles.gap}>
            <Text variant="body" color={theme.textMuted}>
              Dump everything on your mind. We’ll split it into focused tasks.
            </Text>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={'e.g. finish the Q3 report, reply to Sam, draft the onboarding email…'}
              placeholderTextColor={theme.textMuted}
              multiline
              autoFocus
              style={[
                styles.textarea,
                { backgroundColor: theme.bgElevated, borderColor: theme.borderStrong, color: theme.text },
              ]}
            />
          </View>
        ) : null}

        {mode === 'loading' ? (
          <View style={styles.loading}>
            <ActivityIndicator color={theme.accent} />
            <Text variant="body" color={theme.textMuted}>
              Organizing your tasks…
            </Text>
          </View>
        ) : null}

        {mode === 'review' ? (
          parsed.length > 0 ? (
            <ParsedTaskList tasks={parsed} onChange={setParsed} />
          ) : (
            <Text variant="body" color={theme.textMuted}>
              No tasks left — go back to add more.
            </Text>
          )
        ) : null}

        {mode === 'manual' ? (
          <View style={styles.gap}>
            {notice ? (
              <Text variant="body" color={theme.textMuted}>
                {notice}
              </Text>
            ) : null}
            <ManualTaskForm onSubmit={onManualSubmit} />
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {mode === 'input' ? (
          <Button label="Organize tasks" onPress={onOrganize} disabled={text.trim().length === 0} />
        ) : null}
        {mode === 'review' ? (
          <>
            <Button
              label={`Save ${parsed.length} ${parsed.length === 1 ? 'task' : 'tasks'}`}
              onPress={onSaveParsed}
              disabled={parsed.length === 0}
            />
            <Button label="Back" variant="ghost" onPress={() => setMode('input')} />
          </>
        ) : null}
        {mode === 'manual' ? (
          <Button label="Try organizing again" variant="ghost" onPress={() => setMode('input')} />
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 12,
  },
  body: { paddingHorizontal: 24, paddingBottom: 16, flexGrow: 1, gap: 16 },
  gap: { gap: 12 },
  textarea: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 48 },
  footer: { paddingHorizontal: 24, paddingTop: 8, gap: 8 },
});
