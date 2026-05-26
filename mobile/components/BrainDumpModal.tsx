/**
 * Brain-dump modal (S2.4). Free-text capture → parseTasks() → review the parsed
 * list and save, with a manual-entry path (first-class up front per L14, and the
 * fallback when parsing fails). The two creation paths from task-queue.md.
 *
 * The review list is the shared DraggableTaskList (same drag/swipe as the queue
 * sheet), so the parsed tasks get temp ids for its stable keys; they're stripped
 * on save. parseTasks zod-validates every response (CLAUDE.md), so the parsed
 * rows are always well-formed. Save persists via useTaskStore.addTasks (M2.5).
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
import { DraggableTaskList } from './DraggableTaskList';
import { ManualTaskForm } from './ManualTaskForm';
import { parseTasks, type ParseFailReason, type ParsedTask } from '../services/llm';
import { useTaskStore } from '../stores/useTaskStore';
import { useOnboardingStore } from '../stores/useOnboardingStore';
import type { AddTaskInput } from '../services/tasks';
import { useTheme } from '../theme';

type Mode = 'input' | 'loading' | 'review' | 'manual';
/** Parsed task + a temp id for the draggable list's stable key (stripped on save). */
type ParsedRow = ParsedTask & { id: string };

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
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  async function onOrganize() {
    const input = text.trim();
    if (!input) return;
    setMode('loading');
    const res = await parseTasks(input, useCase);
    if (res.ok) {
      setParsed(res.tasks.map((t, i) => ({ ...t, id: `p${Date.now()}-${i}` })));
      setMode('review');
    } else {
      setNotice(noticeFor(res.reason));
      setMode('manual');
    }
  }

  function onSaveParsed() {
    if (parsed.length === 0) return;
    // Strip the temp id back to ParsedTask before persisting.
    addTasks(parsed.map((p) => ({ title: p.title, estMinutes: p.estMinutes, difficulty: p.difficulty })));
    onClose();
  }

  function onManualSubmit(input: AddTaskInput) {
    addTask(input);
    onClose();
  }

  // First-class manual entry (decisions.md L14) — reachable up front, not only
  // after an LLM failure. Clears any prior failure notice so the form is clean.
  function startManual() {
    setNotice(null);
    setMode('manual');
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <Text variant="heading">{mode === 'manual' ? 'Add a task' : 'Brain-dump'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
          <Text variant="heading" color={theme.textMuted}>
            ✕
          </Text>
        </Pressable>
      </View>

      {/* Review uses the draggable list, which is its own scroller — so it lives
          OUTSIDE the ScrollView (nesting VirtualizedLists in a ScrollView breaks
          scroll + drag). Every other mode uses the keyboard-aware ScrollView. */}
      {mode === 'review' ? (
        <View style={styles.reviewBody}>
          {parsed.length > 0 ? (
            <DraggableTaskList
              items={parsed}
              onReorder={(from, to) =>
                setParsed((cur) => {
                  const next = cur.slice();
                  const [moved] = next.splice(from, 1);
                  next.splice(to, 0, moved);
                  return next;
                })
              }
              onRemove={(item) => setParsed((cur) => cur.filter((x) => x.id !== item.id))}
            />
          ) : (
            <View style={styles.emptyReview}>
              <Text variant="body" color={theme.textMuted} style={styles.center}>
                No tasks left — go back to add more.
              </Text>
            </View>
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
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
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {mode === 'input' ? (
          <>
            <Button label="Organize tasks" onPress={onOrganize} disabled={text.trim().length === 0} />
            <Button label="Add a task manually" variant="ghost" onPress={startManual} />
          </>
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
          <Button
            label="Use brain-dump instead"
            variant="ghost"
            onPress={() => {
              setNotice(null);
              setMode('input');
            }}
          />
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
  reviewBody: { flex: 1, paddingHorizontal: 24 },
  emptyReview: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
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
