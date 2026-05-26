/**
 * Streak counter (S2.2). Compact widget for the Home top-right showing the
 * current focus streak in days, read from `useUserStore().currentStreak`.
 *
 * Restraint by design: a streak of 0 gets no fire, no celebration — just the
 * number and a "Day 0" caption. From day 1 it lights up (🔥) and the caption
 * pluralizes (day / days).
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './ui';
import { useUserStore } from '../stores/useUserStore';
import { useTheme } from '../theme';

export function StreakCounter({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const streak = useUserStore((s) => s.currentStreak);
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
