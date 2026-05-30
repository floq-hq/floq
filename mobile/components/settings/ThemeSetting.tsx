/**
 * Theme picker — System / Light / Dark, bound to the theme override store
 * (theme/ThemeContext, persisted to MMKV under `floq.theme_override`). `system`
 * follows the device appearance live; `light`/`dark` pin it. Mirrors
 * BackgroundPolicySetting's radio-row layout so the settings list reads uniform.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui';
import { useTheme, useThemeSettings, type ThemeOverride } from '../../theme';

const OPTIONS: { value: ThemeOverride; title: string; line: string }[] = [
  { value: 'system', title: 'System', line: 'Match your device appearance.' },
  { value: 'light', title: 'Light', line: 'Always use the light theme.' },
  { value: 'dark', title: 'Dark', line: 'Always use the dark theme.' },
];

export function ThemeSetting() {
  const theme = useTheme();
  const { override, setOverride } = useThemeSettings();

  return (
    <View style={styles.section}>
      <Text variant="heading">Appearance</Text>

      <View style={styles.options} accessibilityRole="radiogroup">
        {OPTIONS.map((opt) => {
          const selected = opt.value === override;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setOverride(opt.value)}
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
