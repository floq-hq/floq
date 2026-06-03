/**
 * Home (Home redesign v2) — the HUB. Manage your queue + see your data here;
 * START a session on the Session tab. A pinned header (wordmark + today's date +
 * your avatar) stays put while the body scrolls and fades at the edges.
 *
 *  • Queued     — greeting, a prominent streak, the weekly FOCUS SCORE hero, a
 *                 today stat row, a tappable UP NEXT card, and a "Go to Session
 *                 →" CTA + "+" add square.
 *  • Returning  — welcome-back + yesterday recap, brain-dump / add CTAs.
 *  • First-time — calm visual + the baseline framing.
 *
 * The recommendation ring lives on the Session screen; Home shows the focus
 * SCORE. design-system.md: calm / anti-gamified / single teal accent / no emoji.
 */
import { useEffect } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Button, Card, ScrollFade, Text, Wordmark } from '../../components/ui';
import { OfflineIndicator } from '../../components/OfflineIndicator';
import { TaskSummary } from '../../components/TaskSummary';
import { PartnerFinishCard } from '../../components/partner/PartnerFinishCard';
import { FirstTimeVisual } from '../../components/home/FirstTimeVisual';
import { HeroRing } from '../../components/home/HeroRing';
import { coachLine, formatLastSession, greeting } from '../../components/home/copy';
import { selectHiddenCount, selectTopTask, useTaskStore } from '../../stores/useTaskStore';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import { useCurrentUser } from '../../services/firebase';
import { useUserProfile } from '../../services/firebase/userProfile';
import { useSessionRecommendation } from '../../services/session/useSessionRecommendation';
import { useNowContext } from '../../services/session/nowContext';
import {
  useCurrentStreak,
  useLastSessionEndedAt,
  useSessionCount,
  useYesterdayRecap,
} from '../../services/stats/useStats';
import { useTheme, type Theme } from '../../theme';

const PADDING = 20;

export default function Home() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { user } = useCurrentUser();
  const { data: profile } = useUserProfile();
  const name = profile?.displayName || user?.displayName || 'Floq user';

  const hydrated = useTaskStore((s) => s.hydrated);
  const hydrate = useTaskStore((s) => s.hydrate);
  const onboardingHydrated = useOnboardingStore((s) => s.hydrated);
  const hydrateOnboarding = useOnboardingStore((s) => s.hydrate);
  const topTask = useTaskStore(selectTopTask);
  const hiddenCount = useTaskStore(selectHiddenCount);

  const lifetime = useSessionCount().data ?? 0;
  const streak = useCurrentStreak().data ?? 0;
  const recap = useYesterdayRecap().data ?? null;
  const lastEndedAt = useLastSessionEndedAt().data ?? null;
  // The recommendation hero — a PREVIEW of computeSessionPlan for the up-next
  // task (no task → no recommendation). The coach line reads its regime.
  const plan = useSessionRecommendation(topTask).data ?? null;
  const nowCtx = useNowContext().data ?? null;

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);
  // Self-heal onboarding so the recommendation/coach line never blanks.
  useEffect(() => {
    if (!onboardingHydrated) void hydrateOnboarding();
  }, [onboardingHydrated, hydrateOnboarding]);

  const openBrainDump = () => router.push('/brain-dump');
  const openQueue = () => router.push('/task-queue');
  const goToSession = () => router.navigate('/session');
  const goToStats = () => router.navigate('/stats');
  const openAccount = () => router.push('/account');

  if (!hydrated) {
    return <View style={styles.root} />;
  }

  const state: 'queued' | 'returning' | 'first' = topTask
    ? 'queued'
    : lifetime === 0
      ? 'first'
      : 'returning';

  return (
    <View style={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 6 }]}>
      {/* Pinned header — wordmark + today's date stay at the top while scrolling. */}
      <View style={styles.header}>
        <View>
          <Wordmark />
          <Text variant="caption" color={theme.textMuted} style={styles.date}>
            {dateLabel}
          </Text>
        </View>
        <View style={styles.headerRight}>
          <OfflineIndicator />
          <Pressable onPress={openAccount} accessibilityRole="button" accessibilityLabel="Account" hitSlop={8}>
            <Avatar photoURL={user?.photoURL} name={name} size={38} />
          </Pressable>
        </View>
      </View>

      <View style={styles.scrollWrap}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            state === 'queued' ? styles.topAlign : styles.centerAlign,
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* S7.3: "what your partner did" — self-hides when solo / muted / nothing new. */}
          <PartnerFinishCard />

          {state === 'queued' ? (
            <>
              <Text variant="heading">{greeting(Date.now())}</Text>

              <Pressable
                onPress={goToStats}
                accessibilityRole="button"
                accessibilityLabel={`${streak} day streak — see your stats`}
                style={({ pressed }) => [
                  styles.streakBanner,
                  { backgroundColor: theme.accentMuted, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <Text variant="title" color={theme.accent}>
                  {streak}
                </Text>
                <Text variant="bodyMedium">day streak</Text>
                <View style={styles.flex1} />
                <Text variant="body" color={theme.textMuted}>
                  ›
                </Text>
              </Pressable>

              {plan ? (
                <View style={styles.hero}>
                  <HeroRing focusMinutes={plan.focusMinutes} breakMinutes={plan.breakMinutes} />
                  {nowCtx ? (
                    <Text variant="body" color={theme.textMuted} style={styles.coach}>
                      {coachLine(plan.regime, nowCtx)}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              <Pressable
                onPress={openQueue}
                accessibilityRole="button"
                accessibilityLabel="Manage your task queue"
              >
                <Card>
                  <View style={styles.upNextHead}>
                    <Text variant="tiny" color={theme.textMuted} style={styles.kicker}>
                      UP NEXT
                    </Text>
                    <Text variant="label" color={theme.accent}>
                      {hiddenCount > 0 ? `+${hiddenCount} more ›` : 'Edit ›'}
                    </Text>
                  </View>
                  <TaskSummary
                    title={topTask!.title}
                    difficulty={topTask!.difficulty}
                    estMinutes={topTask!.estMinutes}
                  />
                </Card>
              </Pressable>
            </>
          ) : null}

          {state === 'returning' ? (
            <View style={styles.block}>
              <View style={styles.welcome}>
                <Text variant="title">Welcome back</Text>
                <Text variant="caption" color={theme.textMuted}>
                  Day {streak}
                  {lastEndedAt ? ` · last session ${formatLastSession(lastEndedAt, Date.now())}` : ''}
                </Text>
              </View>

              {recap ? (
                <Card>
                  <Text variant="tiny" color={theme.textMuted} style={styles.kicker}>
                    YESTERDAY
                  </Text>
                  <View style={styles.recapRow}>
                    <StatCol theme={theme} value={recap.focusMinutes} label="min focused" center />
                    <StatCol theme={theme} value={recap.sessions} label={recap.sessions === 1 ? 'session' : 'sessions'} center />
                    <StatCol
                      theme={theme}
                      value={recap.distractions}
                      label={recap.distractions === 1 ? 'distraction' : 'distractions'}
                      center
                    />
                  </View>
                </Card>
              ) : null}
            </View>
          ) : null}

          {state === 'first' ? (
            <View style={styles.firstTime}>
              <FirstTimeVisual />
              <Text variant="title" style={styles.center}>
                Welcome to Floq
              </Text>
              <Text variant="body" color={theme.textMuted} style={styles.center}>
                Floq tunes the timer to your brain. Add what you want to focus on first — your first
                session sets your baseline.
              </Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Soft fade where content scrolls under the header (top only — a bottom
            fade read as a stray gradient above the CTA). */}
        <ScrollFade edge="top" color={theme.bg} />
      </View>

      <View style={styles.footer}>
        {state === 'queued' ? (
          <View style={styles.ctaRow}>
            <Button label="Go to Session  →" onPress={goToSession} style={styles.ctaPrimary} />
            <AddSquare theme={theme} onPress={openBrainDump} />
          </View>
        ) : null}
        {state === 'returning' ? (
          <View style={styles.ctaRow}>
            <Button label="Brain-dump" onPress={openBrainDump} style={styles.ctaPrimary} />
            <AddSquare theme={theme} onPress={openQueue} />
          </View>
        ) : null}
        {state === 'first' ? (
          <Button label="Brain-dump tasks" onPress={openBrainDump} />
        ) : null}
      </View>
    </View>
  );
}

/** A momentum/recap stat: a prominent value over a quiet label. Borderless. */
function StatCol({
  theme,
  value,
  label,
  center,
}: {
  theme: Theme;
  value: number;
  label: string;
  center?: boolean;
}) {
  return (
    <View style={[styles.statCol, center && styles.centerItems]}>
      <Text variant="title">{value}</Text>
      <Text variant="caption" color={theme.textMuted} style={center && styles.center}>
        {label}
      </Text>
    </View>
  );
}

/** Square add-task button beside the primary CTA — distinct neutral surface so
 *  it reads as secondary to the teal CTA. */
function AddSquare({ theme, onPress }: { theme: Theme; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add tasks"
      style={[styles.addSquare, { backgroundColor: theme.bgElevated, borderColor: theme.borderStrong }]}
    >
      <Text variant="title" color={theme.accent} style={styles.plus}>
        +
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: PADDING },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  date: { marginTop: 2, textTransform: 'capitalize' },

  scrollWrap: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1, gap: 16, paddingVertical: 14 },
  topAlign: { justifyContent: 'flex-start' },
  centerAlign: { justifyContent: 'center' },
  center: { textAlign: 'center' },
  centerItems: { alignItems: 'center' },
  kicker: { letterSpacing: 1 },
  flex1: { flex: 1 },

  streakBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },

  statCol: { flex: 1, gap: 2 },

  hero: { alignItems: 'center', gap: 12, marginVertical: 4 },
  coach: { textAlign: 'center', paddingHorizontal: 8 },

  upNextHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },

  block: { gap: 20 },
  welcome: { alignItems: 'center', gap: 6 },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between' },
  firstTime: { alignItems: 'center', gap: 16 },

  footer: { gap: 10 },
  ctaRow: { flexDirection: 'row', gap: 10, alignItems: 'stretch' },
  ctaPrimary: { flex: 1 },
  addSquare: {
    width: 52,
    height: 52,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: { width: '100%', textAlign: 'center', lineHeight: 50 },
});
