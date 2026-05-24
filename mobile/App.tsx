import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  ThemeProvider,
  getTextStyle,
  useTheme,
  useThemeSettings,
  type ThemeOverride,
} from './theme';

// Temporary S1.2 verification harness. Replaced by Expo Router screens later.
const OVERRIDES: ThemeOverride[] = ['system', 'light', 'dark'];

function Swatch({ name, color }: { name: string; color: string }) {
  const theme = useTheme();
  return (
    <View style={styles.swatchRow}>
      <View style={[styles.swatchChip, { backgroundColor: color, borderColor: theme.border }]} />
      <Text style={[getTextStyle('caption', theme), { color: theme.textMuted }]}>
        {name} {color}
      </Text>
    </View>
  );
}

function ThemeDemo() {
  const theme = useTheme();
  const { scheme, override, setOverride } = useThemeSettings();

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={getTextStyle('title', theme)}>Floq theme</Text>
        <Text style={[getTextStyle('body', theme), { color: theme.textMuted }]}>
          resolved: {scheme} · override: {override}
        </Text>

        <View style={styles.segment}>
          {OVERRIDES.map((opt) => {
            const active = override === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => setOverride(opt)}
                style={[
                  styles.segmentItem,
                  {
                    backgroundColor: active ? theme.accent : theme.bgElevated,
                    borderColor: theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    getTextStyle('label', theme),
                    { color: active ? theme.textInverse : theme.text },
                  ]}
                >
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Swatch name="bg" color={theme.bg} />
        <Swatch name="bgElevated" color={theme.bgElevated} />
        <Swatch name="text" color={theme.text} />
        <Swatch name="accent" color={theme.accent} />
        <Swatch name="phase.struggle" color={theme.phase.struggle} />
        <Swatch name="phase.release" color={theme.phase.release} />
        <Swatch name="phase.flow" color={theme.phase.flow} />
        <Swatch name="phase.recovery" color={theme.phase.recovery} />
      </ScrollView>
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemeDemo />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingTop: 72, gap: 12 },
  segment: { flexDirection: 'row', gap: 8, marginVertical: 12 },
  segmentItem: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  swatchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  swatchChip: { width: 40, height: 40, borderRadius: 8, borderWidth: 1 },
});
