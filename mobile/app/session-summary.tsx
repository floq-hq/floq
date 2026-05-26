/**
 * Session-end summary (S3.3). A brief, calm recap shown after DONE — minutes
 * focused, distractions, focus score, streak, and the enforced recovery break
 * (session-flow.md §Session-end summary). Anti-gamified per the design system:
 * no celebration, no confetti — restrained typography.
 *
 * The DONE handler (session.tsx) already ended the session, wrote the record, and
 * promoted the next task; this screen only displays the result it was handed via
 * route params. Auto-dismisses to the recovery state (Home) after 8s or on tap.
 *
 * Focus score shows "—" until M4.1 (the frozen focus-score formula) lands; the
 * streak stays at its current store value until M4.4 wires session-derived updates.
 */
import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/ui';
import { useUserStore } from '../stores/useUserStore';
import { useTheme } from '../theme';

const AUTO_DISMISS_MS = 8000;

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
  }>();
  const minutes = Number(params.minutes ?? 0);
  const distractions = Number(params.distractions ?? 0);
  const breakMinutes = Number(params.breakMinutes ?? 0);
  const score = typeof params.score === 'string' ? Number(params.score) : null;
  const streak = useUserStore((s) => s.currentStreak);

  // Auto-dismiss to recovery (Home) after 8s; tapping anywhere does the same.
  const dismiss = useCallback(() => router.replace('/home'), []);
  useEffect(() => {
    const t = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [dismiss]);

  return (
    <Pressable
      onPress={dismiss}
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
          <Stat label="Focus score" value={score == null ? '—' : String(score)} />
          <Stat label="Streak" value={String(streak)} />
        </View>

        <View style={[styles.recovery, { borderColor: theme.border }]}>
          <Text variant="bodyMedium">{`Recovery · ${breakMinutes} min`}</Text>
          <Text variant="caption" color={theme.textMuted}>
            before your next session
          </Text>
        </View>
      </View>

      <Text variant="caption" color={theme.textMuted}>
        Tap to continue
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'space-between' },
  body: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 32 },
  hero: { alignItems: 'center', gap: 4 },
  stats: { flexDirection: 'row', alignSelf: 'stretch' },
  stat: { flex: 1, alignItems: 'center', gap: 4 },
  recovery: {
    alignSelf: 'stretch',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
});
