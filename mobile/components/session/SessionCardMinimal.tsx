/**
 * Shareable session card — C3 "editorial minimal" (S6.0). The quiet alternate to
 * the curve card: mostly whitespace, the insight sentence as a typographic hero,
 * one thin phase ribbon for identity, a small meta line, and the Floq mark. Most
 * "quiet OS", maximally anti-gamified.
 *
 * Same 320 width + tokens as SessionCardCurve so the share capture matches. NO
 * task title (privacy, L4). Pure presentational (the modal owns capture/share).
 */
import { StyleSheet, View } from 'react-native';
import { Text, Wordmark } from '../ui';
import { useTheme } from '../../theme';
import { phaseSegments } from './phaseSegments';
import type { SessionCardData } from '../../services/share/sessionInsight';

const CARD_W = 320;

export function SessionCardMinimal({ data, insight }: { data: SessionCardData; insight: string }) {
  const theme = useTheme();
  const segments = phaseSegments(data.focusMinutes);
  const minutes = Math.round(data.focusMinutes);
  const distractions = data.distractionCount;
  const score = Math.round(data.focusScore);
  const scoreColor = score < 0 ? theme.danger : theme.textMuted;

  return (
    <View style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
      <Wordmark height={20} />

      <Text variant="title" color={theme.text} style={styles.hero}>
        {insight}
      </Text>

      {segments.length > 0 && (
        <View style={styles.ribbon}>
          {segments.map((s, i) => (
            <View
              key={s.phase}
              style={[
                { flex: s.fraction, backgroundColor: theme.phase[s.phase] },
                i === 0 && styles.ribbonStart,
                i === segments.length - 1 && styles.ribbonEnd,
              ]}
            />
          ))}
        </View>
      )}

      <Text variant="caption" color={theme.textMuted} style={styles.meta}>
        {minutes} min · {distractions} distraction{distractions === 1 ? '' : 's'} · score{' '}
        <Text variant="caption" color={scoreColor}>{score}</Text>
      </Text>
    </View>
  );
}

const RIBBON_RADIUS = 3;

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    borderWidth: 1,
    borderRadius: 16,
    padding: 28,
    gap: 24,
  },
  hero: { lineHeight: 36 },
  ribbon: { flexDirection: 'row', height: 6, borderRadius: RIBBON_RADIUS, overflow: 'hidden' },
  ribbonStart: { borderTopLeftRadius: RIBBON_RADIUS, borderBottomLeftRadius: RIBBON_RADIUS },
  ribbonEnd: { borderTopRightRadius: RIBBON_RADIUS, borderBottomRightRadius: RIBBON_RADIUS },
  meta: {},
});
