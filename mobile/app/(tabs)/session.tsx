/**
 * Session tab — the LAUNCHPAD. This is where you start a focus session, so it
 * shows what Home (the hub) doesn't: the task you're about to focus on AND the
 * adaptive recommendation for it (the hero ring + the "why" — regime, time-of-
 * day window, rested state). Starting opens the full-screen /focus takeover via
 * the shared useStartSession flow; the tab bar disappears for the session.
 *
 * The recommendation is a PREVIEW of computeSessionPlan (read, never changed).
 * Onboarding answers are self-healed here too (a dev Fast Refresh can null the
 * store) so the ring never blanks.
 */
import { useEffect } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, Text } from '../../components/ui';
import { TaskSummary } from '../../components/TaskSummary';
import { HeroRing } from '../../components/home/HeroRing';
import { regimeLabel, restedClause, windowClause } from '../../components/home/copy';
import { FirstSessionFramingCard } from '../../components/FirstSessionFramingCard';
import { useStartSession } from '../../components/session/useStartSession';
import { selectTopTask, useTaskStore } from '../../stores/useTaskStore';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import { useSessionRecommendation } from '../../services/session/useSessionRecommendation';
import { useNowContext } from '../../services/session/nowContext';
import { useTheme } from '../../theme';

const PADDING = 20;

export default function SessionTab() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const hydrated = useTaskStore((s) => s.hydrated);
  const hydrate = useTaskStore((s) => s.hydrate);
  const onboardingHydrated = useOnboardingStore((s) => s.hydrated);
  const hydrateOnboarding = useOnboardingStore((s) => s.hydrate);
  const topTask = useTaskStore(selectTopTask);
  const { onStart, launching, launchError, showIntro, onIntroDismiss } = useStartSession(topTask);

  const plan = useSessionRecommendation(topTask).data ?? null;
  const nowCtx = useNowContext().data ?? null;

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);
  // Self-heal onboarding so the recommendation never blanks (see home.tsx note).
  useEffect(() => {
    if (!onboardingHydrated) void hydrateOnboarding();
  }, [onboardingHydrated, hydrateOnboarding]);

  return (
    <View
      style={[styles.root, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {topTask ? (
          <>
            <Card>
              <Text variant="tiny" color={theme.textMuted} style={styles.kicker}>
                FOCUSING ON
              </Text>
              <TaskSummary
                title={topTask.title}
                difficulty={topTask.difficulty}
                estMinutes={topTask.estMinutes}
              />
            </Card>

            {plan ? (
              <View style={styles.hero}>
                <HeroRing focusMinutes={plan.focusMinutes} breakMinutes={plan.breakMinutes} />
                <Text variant="caption" color={theme.textMuted}>
                  {regimeLabel(plan.regime)}
                </Text>
                {nowCtx ? (
                  <Text variant="caption" color={theme.textMuted} style={styles.center}>
                    {windowClause(nowCtx)} {restedClause(nowCtx)}
                  </Text>
                ) : null}
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.empty}>
            <Text variant="title" style={styles.center}>
              Nothing to focus on yet
            </Text>
            <Text variant="body" color={theme.textMuted} style={styles.center}>
              Add a task on Home, then come back to start.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {topTask ? (
          <Button label="Begin focus" onPress={onStart} loading={launching} />
        ) : (
          <Button label="Brain-dump" onPress={() => router.push('/brain-dump')} />
        )}
        {launchError ? (
          <Text variant="caption" color={theme.danger} style={styles.center}>
            {launchError}
          </Text>
        ) : null}
      </View>

      <FirstSessionFramingCard visible={showIntro} onDismiss={onIntroDismiss} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: PADDING },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', gap: 20, paddingVertical: 12 },
  kicker: { letterSpacing: 1, marginBottom: 10 },
  hero: { alignItems: 'center', gap: 8 },
  empty: { alignItems: 'center', gap: 8 },
  center: { textAlign: 'center' },
  footer: { gap: 10 },
});
