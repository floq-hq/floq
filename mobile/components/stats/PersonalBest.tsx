/**
 * Personal best (S5.1) — the all-time view, distinct from the rolling-week
 * SummaryCards above it. Three bests: highest single score + longest streak
 * (two stat columns), and the richer "best session" line (task title · minutes ·
 * score · date) beneath a hairline divider.
 *
 * Data is all-time (not windowed): `usePersonalBest` (MAX focus_score),
 * `useLongestStreak` (longest consecutive-day run), `useBestSession` (the full
 * peak-score row). `null`/0 renders an em-dash or a calm empty line so a new
 * user doesn't read placeholders as real zeros — same treatment as SummaryCards.
 *
 * Negative bests get the softer `danger` signal (matches HeroScore / SessionList):
 * a Day-1 user whose only session scored negative still has that as their "best",
 * and a bare "-12" with no visual context lands harsh.
 *
 * Task titles are owner-private (CLAUDE.md L4) — fine on the user's own screen,
 * never across the partner edge.
 */
import { StyleSheet, View } from 'react-native';
import { Card, Text } from '../ui';
import { useTheme } from '../../theme';
import type { Theme } from '../../theme/tokens';
import type { CompletedSession } from '../../services/session/types';
import {
  useBestSession,
  useLongestStreak,
  usePersonalBest,
} from '../../services/stats/useStats';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** Compact, locale-stable date for an all-time best (e.g. "8 Mar"). A relative
 *  "45d ago" reads worse than a date once the best session is weeks back. */
function formatBestDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function PersonalBest() {
  const theme = useTheme();
  const { data: best } = usePersonalBest();
  const { data: longest } = useLongestStreak();
  const { data: bestSession } = useBestSession();

  const longestValue = longest ?? 0;

  return (
    <Card style={styles.card}>
      <Text variant="caption" color={theme.textMuted}>
        Personal best
      </Text>

      <View style={styles.statRow}>
        <Stat
          theme={theme}
          label="Highest score"
          value={best == null ? '—' : String(Math.round(best))}
          negative={best != null && best < 0}
        />
        <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
        <Stat
          theme={theme}
          label="Longest streak"
          value={String(longestValue)}
          unit={longestValue === 1 ? 'day' : 'days'}
        />
      </View>

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      <BestSession theme={theme} session={bestSession ?? null} />
    </Card>
  );
}

function Stat({
  theme,
  label,
  value,
  unit,
  negative = false,
}: {
  theme: Theme;
  label: string;
  value: string;
  unit?: string;
  negative?: boolean;
}) {
  return (
    <View
      style={styles.stat}
      accessibilityRole="summary"
      accessibilityLabel={`${label}: ${value}${unit ? ` ${unit}` : ''}`}
    >
      <Text variant="caption" color={theme.textMuted}>
        {label}
      </Text>
      <Text variant="title" color={negative ? theme.danger : undefined} style={styles.statValue}>
        {value}
      </Text>
      <Text variant="caption" color={theme.textMuted}>
        {unit ?? 'score'}
      </Text>
    </View>
  );
}

function BestSession({ theme, session }: { theme: Theme; session: CompletedSession | null }) {
  if (session == null) {
    return (
      <Text variant="caption" color={theme.textMuted} style={styles.bestEmpty}>
        Your best session will land here.
      </Text>
    );
  }

  const score = Math.round(session.focusScore);
  const scoreColor = score < 0 ? theme.danger : theme.textMuted;
  const meta = `${session.actualFocusMinutes}m · score ${score} · ${formatBestDate(session.endedAt)}`;

  return (
    <View
      style={styles.best}
      accessibilityRole="summary"
      accessibilityLabel={`Best session: ${session.task.title}, ${session.actualFocusMinutes} minutes, focus score ${score}, ${formatBestDate(session.endedAt)}`}
    >
      <Text variant="caption" color={theme.textMuted}>
        Best session
      </Text>
      <Text variant="bodyMedium" numberOfLines={1} style={styles.bestTitle}>
        {session.task.title}
      </Text>
      <Text variant="caption" color={scoreColor}>
        {meta}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  statRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stat: { flex: 1, gap: 2 },
  statValue: { marginTop: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', marginHorizontal: 12 },
  divider: { height: StyleSheet.hairlineWidth },
  best: { gap: 2 },
  bestTitle: { marginTop: 2 },
  bestEmpty: { paddingVertical: 4 },
});
