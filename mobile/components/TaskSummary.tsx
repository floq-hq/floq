/**
 * TaskSummary — the ONE way a task is presented anywhere in Floq: a title over a
 * quiet "Hard · ~70 min" meta line (difficulty humanized via difficultyLabel,
 * never a raw "4/5"). Used by the Home UP NEXT card, the Session-tab launchpad,
 * and every queue/brain-dump row, so the task reads identically everywhere.
 *
 * Title wrapping is the caller's call via `titleLines`: omit it in cards (wrap
 * fully — long titles are never clipped) or pass 2 in dense list rows. Per
 * design-system.md (single accent, low-noise) the meta carries no colored chips;
 * it's plain muted text.
 */
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Text } from './ui';
import { difficultyLabel, type Difficulty } from '../services/tasks';
import { useTheme } from '../theme';

type Props = {
  title: string;
  difficulty: Difficulty;
  estMinutes: number;
  /** Max title lines; omit to wrap fully (cards), pass 2 for dense list rows. */
  titleLines?: number;
  titleVariant?: 'heading' | 'bodyMedium';
};

function TaskSummaryBase({
  title,
  difficulty,
  estMinutes,
  titleLines,
  titleVariant = 'heading',
}: Props) {
  const theme = useTheme();
  return (
    <View style={styles.root}>
      <Text variant={titleVariant} numberOfLines={titleLines}>
        {title}
      </Text>
      <Text variant="caption" color={theme.textMuted}>
        {difficultyLabel(difficulty)} · ~{estMinutes} min
      </Text>
    </View>
  );
}

export const TaskSummary = memo(TaskSummaryBase);

const styles = StyleSheet.create({
  root: { gap: 6 },
});
