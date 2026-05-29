/**
 * Streak counter (S2.2 + PR3 Bug #4). Compact widget for the Home top-right
 * showing the current focus streak in days, sourced from the SQLite-derived
 * M4.4 streak via the TanStack `useCurrentStreak` hook. The same hook powers
 * the Stats screen, so Home / Stats / summary all read one truth — invalidated
 * by `queryClient.invalidateQueries({ queryKey: statsKeys.all })` after every
 * session save (focus.tsx, EndEarlySheet).
 *
 * Restraint by design: a streak of 0 gets no fire, no celebration — just the
 * number and a "Day 0" caption. From day 1 it lights up (🔥) and the caption
 * pluralizes (day / days).
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './ui';
import { useCurrentStreak } from '../services/stats/useStats';
import { useTheme } from '../theme';

export function StreakCounter({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  // useCurrentStreak() returns 0 while the query is loading (queryFn returns a
  // number, never undefined) — so we never render a flash of empty state.
  const streak = useCurrentStreak().data ?? 0;
  const active = streak > 0;

  return (
    <View
      style={[styles.root, style]}
      accessibilityRole="text"
      accessibilityLabel={
        active ? `Current streak: ${streak} ${streak === 1 ? 'day' : 'days'}` : 'Day 0, no streak yet'
      }
    >
      {active ? (
        <Text variant="caption" style={styles.flame}>
          🔥
        </Text>
      ) : null}
      <Text variant="heading">{streak}</Text>
      <Text variant="caption" color={theme.textMuted}>
        {active ? (streak === 1 ? 'day' : 'days') : 'Day 0'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center' },
  flame: { marginBottom: 2 },
});
