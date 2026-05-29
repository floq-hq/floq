/**
 * Stats (S4.1) — historical only. The forecast graph is W6 (S6.1).
 *
 * Layout: hero weekly focus score → three summary cards (streak, personal
 * best, distractions/hr) → forecast section (regime-gated: shows the cold
 * "still learning your rhythm" badge while < 7 sessions, hidden otherwise
 * until the real forecast lands) → recent sessions list.
 *
 * Pull-to-refresh invalidates all M4.3 stats queries; the same invalidation
 * fires automatically from app/focus.tsx onDone, so a freshly-completed
 * session reflects on tab-switch back without the pull.
 *
 * Sign-out relocated to app/settings.tsx (the stats stub's own note flagged
 * it as a temporary tenant of this screen).
 */
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Text } from '../../components/ui';
import { HeroScore } from '../../components/stats/HeroScore';
import { SummaryCards } from '../../components/stats/SummaryCards';
import { SessionList } from '../../components/stats/SessionList';
import { getAllSessionEndedAt } from '../../services/storage/sessions';
import { statsKeys } from '../../services/stats/useStats';
import { useTheme } from '../../theme';

/** Cold regime cutoff for the forecast section (shared/spec/ml-regimes.md). */
const COLD_REGIME_MAX = 7;

export default function StatsTab() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Total session count for the forecast regime gate. Local to this screen
  // (Mohamed's services/stats/ stays untouched); same `['stats']` namespace so
  // it's invalidated alongside the other M4.3 queries.
  const { data: totalSessions = 0 } = useQuery({
    queryKey: ['stats', 'totalSessions'],
    queryFn: () => getAllSessionEndedAt().length,
  });

  const isColdRegime = totalSessions < COLD_REGIME_MAX;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: statsKeys.all });
    setRefreshing(false);
  }, [queryClient]);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: theme.bg }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.accent}
        />
      }
    >
      <Text variant="title" style={styles.header}>
        Stats
      </Text>

      <HeroScore />

      <SummaryCards />

      {isColdRegime && (
        <View style={[styles.forecast, { borderColor: theme.border }]}>
          <Text variant="caption" color={theme.textMuted}>
            Forecast
          </Text>
          <Text variant="bodyMedium" style={styles.forecastBadge}>
            We're still learning your rhythm.
          </Text>
          <Text variant="caption" color={theme.textMuted}>
            {`${COLD_REGIME_MAX - totalSessions} more session${
              COLD_REGIME_MAX - totalSessions === 1 ? '' : 's'
            } to unlock your forecast.`}
          </Text>
        </View>
      )}

      <Text variant="heading" style={styles.section}>
        Recent
      </Text>
      <SessionList />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 24, gap: 16 },
  header: { marginBottom: 4 },
  forecast: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 4,
  },
  forecastBadge: { marginTop: 2 },
  section: { marginTop: 8 },
});
