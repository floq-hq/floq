/**
 * Session-end summary (S3.3 + M4.9 + PR3). A calm stats glance that auto-routes
 * to `/recovery` after 8 seconds. **No interactive decisions live here** —
 * the user reported (2026-05-29) that a tight auto-dismiss left no time to
 * react. The recovery screen has the dwell space (minutes of countdown), so
 * the task-done decision (Option 7 / L19) was moved there.
 *
 * The DONE handler (focus.tsx) writes the session record via finalizeOnDone
 * (M4.5/M4.6) but no longer auto-promotes the task — task completion is
 * explicit (L19). This screen passes `taskId` + `taskTitle` through to
 * `/recovery`, which hosts the affordance.
 *
 * Streak reads `useCurrentStreak()` (TanStack) directly — the prior
 * `useUserStore.currentStreak` was Zustand state with no writer (PR3 Bug #4).
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '../components/ui';
import { SessionCardModal } from '../components/session/SessionCardModal';
import type { SessionCardData } from '../services/share/sessionInsight';
import { useCurrentStreak } from '../services/stats/useStats';
import { useTheme } from '../theme';

const AUTO_ROUTE_MS = 8000;

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text variant="title">{value}</Text>
      <Text variant="caption" color={theme.textMuted}>
        {label}
      </Text>
    </View>
  );
}

export default function SessionSummary() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    minutes?: string;
    distractions?: string;
    breakMinutes?: string;
    score?: string;
    taskId?: string;
    taskTitle?: string;
    doneAt?: string;
  }>();
  const minutes = Number(params.minutes ?? 0);
  const distractions = Number(params.distractions ?? 0);
  const breakMinutes = Number(params.breakMinutes ?? 0);
  const score = typeof params.score === 'string' ? Number(params.score) : null;
  const taskId = typeof params.taskId === 'string' ? params.taskId : '';
  const taskTitle = typeof params.taskTitle === 'string' ? params.taskTitle : '';
  // audit #29: pass the DONE timestamp straight through to /recovery so its
  // countdown anchors to DONE rather than recovery-mount (8s later).
  const doneAt = typeof params.doneAt === 'string' ? params.doneAt : '';
  const streak = useCurrentStreak().data ?? 0;

  // S6.0: optional "share this session" affordance. Building the card needs a
  // focus score, so it's gated on a present score. Opening the card pauses the
  // auto-route (below) so it can't yank the sheet away mid-share.
  const [shareCard, setShareCard] = useState<SessionCardData | null>(null);
  const openShare = useCallback(() => {
    if (score == null) return;
    setShareCard({ focusScore: score, focusMinutes: minutes, distractionCount: distractions });
  }, [score, minutes, distractions]);

  // Route to /recovery — UNLESS the recomputed break is 0 (L21: the user
  // focused too little to need recovery). In that case skip recovery and
  // go straight Home; reuses the PR4 #6 sentinel + the existing /recovery
  // bail. The task identity is forwarded so the recovery screen can host
  // the Mark-task-done affordance (L19) — that's the surface with enough
  // dwell time to make the decision unhurried.
  const routeNext = useCallback(() => {
    if (breakMinutes <= 0) {
      router.replace('/home');
      return;
    }
    router.replace({
      pathname: '/recovery',
      params: {
        breakMinutes: String(breakMinutes),
        ...(taskId ? { taskId, taskTitle } : {}),
        ...(doneAt ? { doneAt } : {}),
      },
    });
  }, [breakMinutes, taskId, taskTitle, doneAt]);

  // Auto-route after 8s; tap-anywhere does the same. The recovery screen is
  // the dwell space; this summary is a glance. Paused while the share card is
  // open so it can't route away mid-share.
  useEffect(() => {
    if (shareCard) return;
    const t = setTimeout(routeNext, AUTO_ROUTE_MS);
    return () => clearTimeout(t);
  }, [routeNext, shareCard]);

  return (
    <Pressable
      onPress={routeNext}
      style={[
        styles.root,
        { backgroundColor: theme.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Session summary. Tap to continue."
    >
      <View style={styles.body}>
        <Text variant="heading" color={theme.textMuted}>
          Session complete
        </Text>

        <View style={styles.hero}>
          <Text variant="display">{minutes}</Text>
          <Text variant="body" color={theme.textMuted}>
            minutes focused
          </Text>
        </View>

        <View style={styles.stats}>
          <Stat label="Distractions" value={String(distractions)} />
          <Stat label="Focus score" value={score == null ? '—' : String(Math.round(score))} />
          <Stat label="Streak" value={String(streak)} />
        </View>

        {score != null && (
          <Button label="Share this session" variant="secondary" onPress={openShare} />
        )}
      </View>

      <Text variant="caption" color={theme.textMuted} style={styles.footer}>
        Tap to continue
      </Text>

      <SessionCardModal data={shareCard} onClose={() => setShareCard(null)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'space-between' },
  body: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 32 },
  hero: { alignItems: 'center', gap: 4 },
  stats: { flexDirection: 'row', alignSelf: 'stretch' },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  footer: { paddingBottom: 8 },
});
