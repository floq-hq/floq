/**
 * Hero score (S4.1) — the big number at the top of the Stats screen.
 *
 * Reads M4.3's weekly focus score (mean across sessions ended in the rolling
 * 7-day window). `null` means "no sessions yet this week" — render an em-dash
 * placeholder rather than a zero, so a blank week doesn't read like a real 0.
 *
 * PR5 (audit Finding #10): a negative weekly hero gets a softer color signal,
 * matching the SessionList treatment of negative scores. Real users hit
 * negative scores on Day 1 (single short session with distractions) and a
 * plain "-6" with no visual context lands harsh.
 */
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui';
import { useTheme } from '../../theme';
import { useWeeklyFocusScore } from '../../services/stats/useStats';

export function HeroScore() {
  const theme = useTheme();
  const { data } = useWeeklyFocusScore();
  const rounded = data == null ? null : Math.round(data);
  const display = rounded == null ? '—' : String(rounded);
  const caption =
    data == null ? 'no sessions yet this week' : 'weekly focus score · last 7 days';
  const scoreColor = rounded != null && rounded < 0 ? theme.danger : undefined;

  return (
    <View
      style={styles.root}
      accessibilityRole="summary"
      accessibilityLabel={
        data == null
          ? 'Weekly focus score: no sessions yet this week'
          : `Weekly focus score ${display}, last 7 days`
      }
    >
      <Text variant="display" style={styles.score} color={scoreColor}>
        {display}
      </Text>
      <Text variant="caption" color={theme.textMuted} style={styles.caption}>
        {caption}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingVertical: 16 },
  score: { lineHeight: 64 },
  caption: { marginTop: 4 },
});
