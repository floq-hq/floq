/**
 * Recent sessions list (S4.1) — the last 20 completed sessions from SQLite.
 *
 * Wrapped in a local TanStack query under `['stats', 'recentSessions']`, so the
 * same `invalidateQueries(['stats'])` after a session-save refreshes this card
 * in lockstep with the M4.3 aggregations.
 *
 * Task titles are owner-private (CLAUDE.md L4 invariant) — fine to show on the
 * user's own Stats screen; never to surface across the partner edge.
 *
 * Up to 20 rows here, so a plain map inside the parent ScrollView is correct;
 * FlashList nested in a ScrollView is the known anti-pattern.
 */
import { StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Text } from '../ui';
import { useTheme } from '../../theme';
import type { Theme } from '../../theme/tokens';
import { getRecentSessions } from '../../services/storage/sessions';
import type { CompletedSession } from '../../services/session/types';

const MAX_ROWS = 20;

export function SessionList() {
  const theme = useTheme();
  const { data } = useQuery({
    queryKey: ['stats', 'recentSessions'],
    queryFn: () => getRecentSessions(MAX_ROWS),
  });

  const sessions = data ?? [];

  if (sessions.length === 0) {
    return (
      <Text variant="caption" color={theme.textMuted} style={styles.empty}>
        No sessions yet — your first one will land here.
      </Text>
    );
  }

  return (
    <View>
      {sessions.map((s) => (
        <SessionRow key={s.id} theme={theme} session={s} />
      ))}
    </View>
  );
}

function SessionRow({ theme, session }: { theme: Theme; session: CompletedSession }) {
  return (
    <View style={[styles.row, { borderBottomColor: theme.border }]}>
      <View style={styles.titleCol}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {session.task.title}
        </Text>
        <Text variant="caption" color={theme.textMuted}>
          {`${session.actualFocusMinutes}m · ${formatRelative(session.endedAt, Date.now())}`}
        </Text>
      </View>
      <Text variant="bodyMedium" color={theme.textMuted}>
        {Math.round(session.focusScore)}
      </Text>
    </View>
  );
}

/** Compact relative time for the row caption. Pure; ms-based. */
function formatRelative(thenMs: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.round((nowMs - thenMs) / 1000));
  if (diffSec < 60) return 'just now';
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  titleCol: { flex: 1, gap: 2 },
});
