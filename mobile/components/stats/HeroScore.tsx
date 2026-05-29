/**
 * Hero score (S4.1) — the big number at the top of the Stats screen.
 *
 * Reads M4.3's weekly focus score (mean across sessions ended in the rolling
 * 7-day window). `null` means "no sessions yet this week" — render an em-dash
 * placeholder rather than a zero, so a blank week doesn't read like a real 0.
 */
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui';
import { useTheme } from '../../theme';
import { useWeeklyFocusScore } from '../../services/stats/useStats';

export function HeroScore() {
  const theme = useTheme();
  const { data } = useWeeklyFocusScore();
  const display = data == null ? '—' : String(Math.round(data));
  const caption =
    data == null ? 'no sessions yet this week' : 'weekly focus score · last 7 days';

  return (
    <View style={styles.root}>
      <Text variant="display" style={styles.score}>
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
