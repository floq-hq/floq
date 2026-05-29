/**
 * Stats (S4.1) — historical layer. The polished forecast chart is W6 (S6.1).
 *
 * Layout: hero weekly focus score → summary cards (current streak,
 * distractions/hr — the "now" glance) → Personal best section (all-time:
 * highest score, longest streak, best session — S5.1) → forecast section
 * (S5.2 — regime-gated: cold badge / warming wide-band / mature tight-band,
 * owned by ForecastSection) → recent sessions.
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
import { useQueryClient } from '@tanstack/react-query';
import { Text } from '../../components/ui';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { HeroScore } from '../../components/stats/HeroScore';
import { SummaryCards } from '../../components/stats/SummaryCards';
import { PersonalBest } from '../../components/stats/PersonalBest';
import { ForecastSection } from '../../components/stats/ForecastSection';
import { SessionList } from '../../components/stats/SessionList';
import { statsKeys } from '../../services/stats/useStats';
import { useTheme } from '../../theme';

export default function StatsTab() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

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

      <PersonalBest />

      <ForecastSection />

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
  section: { marginTop: 8 },
});
