/**
 * Shareable session card (S6.0) — the screenshot-worthy artifact. Renders ONE
 * completed session as "data about your brain": focus score as the hero, the
 * Struggle → Release → Flow phase ribbon, one honest insight line, and a quiet
 * Floq mark. NO task title (privacy, L4) — it must read to someone who's never
 * heard of Floq, not as "I used an app".
 *
 * Pure presentational: it takes a SessionCardData + a precomputed insight string
 * and renders. The capture/share wiring lives in services/share + the modal, so
 * this stays a plain View that view-shot can snapshot. Both themes (token-only).
 */
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui';
import { useTheme } from '../../theme';
import type { Theme } from '../../theme/tokens';
import { phaseSegments, type FocusPhase } from './phaseSegments';
import type { SessionCardData } from '../../services/share/sessionInsight';

const PHASE_LABEL: Record<FocusPhase, string> = {
  struggle: 'Struggle',
  release: 'Release',
  flow: 'Flow',
};

export function SessionCard({ data, insight }: { data: SessionCardData; insight: string }) {
  const theme = useTheme();
  const segments = phaseSegments(data.focusMinutes);
  const score = Math.round(data.focusScore);
  const scoreColor = score < 0 ? theme.danger : theme.text;
  const minutes = Math.round(data.focusMinutes);
  const distractions = data.distractionCount;

  return (
    <View style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
      <View style={styles.header}>
        <Text variant="caption" color={theme.textMuted} style={styles.kicker}>
          FOCUS SESSION
        </Text>
        <Text variant="caption" color={theme.accent} style={styles.markTop}>
          floq
        </Text>
      </View>

      <View style={styles.hero}>
        <Text variant="display" color={scoreColor} style={styles.score}>
          {score}
        </Text>
        <Text variant="caption" color={theme.textMuted}>
          focus score
        </Text>
      </View>

      <Text variant="bodyMedium" color={theme.text} style={styles.meta}>
        {`${minutes} min focused · ${distractions} distraction${distractions === 1 ? '' : 's'}`}
      </Text>

      {segments.length > 0 && (
        <View style={styles.phaseBlock}>
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
          <View style={styles.legend}>
            {segments.map((s) => (
              <View key={s.phase} style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: theme.phase[s.phase] }]} />
                <Text variant="caption" color={theme.textMuted}>
                  {PHASE_LABEL[s.phase]}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <Text variant="bodyMedium" color={theme.text} style={styles.insight}>
        {insight}
      </Text>

      <Text variant="caption" color={theme.textMuted} style={styles.footer}>
        Measured by <Text variant="caption" color={theme.accent}>floq</Text>
      </Text>
    </View>
  );
}

const RIBBON_RADIUS = 6;

const styles = StyleSheet.create({
  card: {
    width: 320,
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    gap: 14,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  kicker: { letterSpacing: 1.5 },
  markTop: { fontWeight: '700', letterSpacing: 0.5 },
  hero: { alignItems: 'flex-start', gap: 2 },
  score: { lineHeight: 64 },
  meta: {},
  phaseBlock: { gap: 8 },
  ribbon: { flexDirection: 'row', height: 12, borderRadius: RIBBON_RADIUS, overflow: 'hidden' },
  ribbonStart: { borderTopLeftRadius: RIBBON_RADIUS, borderBottomLeftRadius: RIBBON_RADIUS },
  ribbonEnd: { borderTopRightRadius: RIBBON_RADIUS, borderBottomRightRadius: RIBBON_RADIUS },
  legend: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  insight: { marginTop: 2 },
  footer: { marginTop: 2 },
});
