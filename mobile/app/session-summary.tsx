/**
 * Session-end summary (S3.3 + M4.9). A brief, calm recap shown after DONE —
 * minutes focused, distractions, focus score, streak, the recomputed recovery
 * break (M4.6), a one-line trade-off note, and an explicit "Skip recovery" CTA
 * (recovery is RECOMMENDED + skippable per L17 — Start is never blocked).
 * Anti-gamified per the design system: no celebration, no confetti.
 *
 * The DONE handler (focus.tsx) already ended the session, wrote the record via
 * finalizeOnDone (M4.6), and promoted the next task; this screen only displays
 * the result it was handed via route params. Auto-dismisses to Home after 8s
 * or on tap or via the explicit Skip CTA — all three land in the same place.
 * The focus score is M4.1 (real number; no longer the "—" placeholder).
 */
import { useCallback, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '../components/ui';
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
          <Text variant="caption" color={theme.textMuted} style={styles.recoveryCaption}>
            recommended break
          </Text>
          {/* M4.9 / L17: the one-line trade-off note. Start is never blocked —
              under-resting just trims the next session's recommendation via
              recovery_mod. No nag, no enforcement. */}
          <Text variant="caption" color={theme.textMuted} style={styles.recoveryNote}>
            Starting before your break ends trims your next session.
          </Text>
        </View>
      </View>

      {/* L17: skip is one tap; the auto-dismiss + tap-to-continue reach the
          same place, but the explicit label makes the choice visible. */}
      <View style={styles.footer}>
        <Button
          label="Skip recovery"
          variant="ghost"
          size="md"
          onPress={dismiss}
        />
        <Text variant="caption" color={theme.textMuted}>
          Tap anywhere to continue
        </Text>
      </View>
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
  recoveryCaption: {},
  recoveryNote: { marginTop: 6, textAlign: 'center' },
  footer: { alignItems: 'center', gap: 4 },
});
