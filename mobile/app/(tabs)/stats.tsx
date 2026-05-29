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
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { HeroScore } from '../../components/stats/HeroScore';
import { SummaryCards } from '../../components/stats/SummaryCards';
import { SessionList } from '../../components/stats/SessionList';
import { getAllSessionEndedAt } from '../../services/storage/sessions';
import { statsKeys } from '../../services/stats/useStats';
import { useTheme } from '../../theme';

/**
 * Sessions required to unlock the forecast chart. Per `shared/spec/ml-regimes.md`
 * §"Performance forecast (Model B — separate from the timer model)":
 *   0–6 sessions  → forecast hidden, learning badge shown
 *   7–13 sessions → forecast visible with wide confidence bands
 *   14+ sessions  → tight bands
 * Note: this is the FORECAST gate, NOT the regime router cutoff (the timer
 * regime is cold at <5, warming at <14, mature at ≥14). Different concept,
 * different number. The previous local name (`FORECAST_MIN_SESSIONS`) conflated
 * the two — renamed for clarity per audit Finding #15.
 */
const FORECAST_MIN_SESSIONS = 7;

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

  const forecastLocked = totalSessions < FORECAST_MIN_SESSIONS;

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
      <View style={styles.headerRow}>
        <Text variant="title">Stats</Text>
        {/* S4.3: hidden while online; no layout shift when it appears. */}
        <OfflineIndicator />
      </View>

      <HeroScore />

      <SummaryCards />

      {forecastLocked && (
        <View style={[styles.forecast, { borderColor: theme.border }]}>
          <Text variant="caption" color={theme.textMuted}>
            Forecast
          </Text>
          <Text variant="bodyMedium" style={styles.forecastBadge}>
            We're still learning your rhythm.
          </Text>
          <Text variant="caption" color={theme.textMuted}>
            {`${FORECAST_MIN_SESSIONS - totalSessions} more session${
              FORECAST_MIN_SESSIONS - totalSessions === 1 ? '' : 's'
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  forecast: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    gap: 4,
  },
  forecastBadge: { marginTop: 2 },
  section: { marginTop: 8 },
});
