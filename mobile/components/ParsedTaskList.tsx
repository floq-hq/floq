/**
 * Parsed-task review list (S2.4). Shows the LLM-parsed tasks (title + est-minutes
 * + difficulty pills) before they're saved, and lets the user reprioritize and
 * prune. Controlled: the parent owns the array and passes `onChange`.
 *
 * Reorder is via ▲▼ controls for now. True drag-to-reorder needs
 * react-native-reanimated + react-native-gesture-handler (not yet installed —
 * pending dep sign-off; they arrive for the W3 timer). Swapping the controls for
 * a draggable list later won't change this component's props.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Card, Pill, Text } from './ui';
import { useTheme } from '../theme';
import type { ParsedTask } from '../services/llm';

export function ParsedTaskList({
  tasks,
  onChange,
}: {
  tasks: ParsedTask[];
  onChange: (next: ParsedTask[]) => void;
}) {
  const theme = useTheme();

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= tasks.length) return;
    const next = tasks.slice();
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const remove = (i: number) => onChange(tasks.filter((_, k) => k !== i));

  return (
    <View style={styles.list}>
      {tasks.map((t, i) => {
        const isFirst = i === 0;
        const isLast = i === tasks.length - 1;
        return (
          <Card key={`${i}-${t.title}`} style={styles.row}>
            <View style={styles.info}>
              <Text variant="bodyMedium" numberOfLines={2}>
                {t.title}
              </Text>
              <View style={styles.pills}>
                <Pill label={`${t.estMinutes} min`} color={theme.textMuted} />
                <Pill label={`Difficulty ${t.difficulty}/5`} color={theme.accent} />
              </View>
            </View>
            <View style={styles.controls}>
              <Pressable
                onPress={() => move(i, -1)}
                disabled={isFirst}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Move up"
              >
                <Text variant="bodyMedium" color={isFirst ? theme.border : theme.text}>
                  ▲
                </Text>
              </Pressable>
              <Pressable
                onPress={() => move(i, 1)}
                disabled={isLast}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Move down"
              >
                <Text variant="bodyMedium" color={isLast ? theme.border : theme.text}>
                  ▼
                </Text>
              </Pressable>
              <Pressable
                onPress={() => remove(i)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${t.title}`}
              >
                <Text variant="bodyMedium" color={theme.danger}>
                  ✕
                </Text>
              </Pressable>
            </View>
          </Card>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  info: { flex: 1, gap: 8 },
  pills: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  controls: { alignItems: 'center', gap: 10 },
});
