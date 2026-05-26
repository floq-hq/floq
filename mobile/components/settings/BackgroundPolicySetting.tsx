/**
 * Background-during-session policy picker (S3.5). Lets the user choose how a
 * mid-session app-background is treated — `forgiving` (>30s, default) vs `strict`
 * (any background) — bound to useSettingsStore (decisions.md L15). The service
 * side (M3.4) reads this on every background→foreground episode.
 *
 * Two options only: option (c) "exempt phone calls / alarms" is deferred (it
 * needs native CallKit, which conflicts with managed Expo — L15), so it is not
 * offered here.
 *
 * Guard-hydrates on mount so the rows reflect the persisted choice (the app also
 * hydrates settings at launch in app/index.tsx; this is idempotent).
 */
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui';
import { useTheme } from '../../theme';
import { useSettingsStore } from '../../stores/useSettingsStore';
import type { BackgroundPolicy } from '../../services/settings/types';

/** The two offered policies, each with a one-line, calm trade-off (S3.5). */
const OPTIONS: { value: BackgroundPolicy; title: string; line: string }[] = [
  {
    value: 'forgiving',
    title: 'Forgiving',
    line: 'Quick switches under 30 seconds are fine — longer logs a distraction.',
  },
  {
    value: 'strict',
    title: 'Strict',
    line: 'Any time you leave the app mid-session logs a distraction.',
  },
];

export function BackgroundPolicySetting() {
  const theme = useTheme();
  const policy = useSettingsStore((s) => s.settings.backgroundPolicy);
  const setPolicy = useSettingsStore((s) => s.setBackgroundPolicy);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const hydrate = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  return (
    <View style={styles.section}>
      <Text variant="heading">Leaving a session</Text>
      <Text variant="body" color={theme.textMuted} style={styles.intro}>
        Sessions can&apos;t be paused — leaving the app mid-session counts as a distraction. Choose how
        forgiving that is.
      </Text>

      <View style={styles.options} accessibilityRole="radiogroup">
        {OPTIONS.map((opt) => {
          const selected = opt.value === policy;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setPolicy(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${opt.title}. ${opt.line}`}
              style={[
                styles.option,
                { backgroundColor: theme.bgElevated, borderColor: selected ? theme.accent : theme.border },
              ]}
            >
              <View style={styles.optionText}>
                <Text variant="bodyMedium">{opt.title}</Text>
                <Text variant="caption" color={theme.textMuted} style={styles.line}>
                  {opt.line}
                </Text>
              </View>
              <View style={[styles.radio, { borderColor: selected ? theme.accent : theme.borderStrong }]}>
                {selected ? <View style={[styles.radioDot, { backgroundColor: theme.accent }]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  intro: { marginBottom: 8 },
  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  optionText: { flex: 1, gap: 4 },
  line: {},
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
