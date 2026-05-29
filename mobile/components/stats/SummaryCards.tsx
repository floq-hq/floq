/**
 * Summary cards (S4.1) — the at-a-glance "now" row under the hero score: current
 * streak + distraction rate (M4.3 / M4.4). `null` from a hook renders an em-dash
 * so an empty week / new user doesn't read as a real zero.
 *
 * PR5 cleanup (audit Finding #9): streak reads the integer; "days" plural
 * unit picks "day" vs "days" so the surface matches Home's StreakCounter.
 * (audit Finding #14): distraction rate rounds to 0 decimals — same precision
 * as score, so the cards read uniformly.
 *
 * S5.1: highest single score moved out of here into the dedicated all-time
 * `PersonalBest` section (it was duplicating that section's label). This row is
 * now purely the current-state glance — current streak (vs the section's
 * longest) + this-week distraction rate.
 */
import { StyleSheet, View } from 'react-native';
import { Card, Text } from '../ui';
import { useTheme } from '../../theme';
import type { Theme } from '../../theme/tokens';
import { useCurrentStreak, useDistractionRate } from '../../services/stats/useStats';

export function SummaryCards() {
  const theme = useTheme();
  const { data: streak } = useCurrentStreak();
  const { data: rate } = useDistractionRate();

  const streakValue = streak ?? 0;

  return (
    <View style={styles.row}>
      <SummaryCard
        theme={theme}
        label="Streak"
        value={String(streakValue)}
        unit={streakValue === 1 ? 'day' : 'days'}
      />
      <SummaryCard
        theme={theme}
        label="Distractions"
        value={rate == null ? '—' : String(Math.round(rate))}
        unit="per hour"
      />
    </View>
  );
}

function SummaryCard({
  theme,
  label,
  value,
  unit,
}: {
  theme: Theme;
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <Card
      style={styles.card}
      accessibilityRole="summary"
      accessibilityLabel={`${label}: ${value} ${unit}`}
    >
      <Text variant="caption" color={theme.textMuted}>
        {label}
      </Text>
      <Text variant="title" style={styles.value}>
        {value}
      </Text>
      <Text variant="caption" color={theme.textMuted}>
        {unit}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  card: { flex: 1, paddingVertical: 12, paddingHorizontal: 10, gap: 2 },
  value: { marginTop: 2 },
});
