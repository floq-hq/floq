/**
 * Dev harness panel (S5.2 acceptance: "mock-test by manually setting
 * sessionsCompleted in dev tools"). Forces the Stats forecast section into each
 * regime-gated state without logging real sessions, then jumps to the Stats tab.
 *
 * Writes the dev override (services/dev/forecastOverride); ForecastSection reads
 * it under __DEV__ and runs the REAL forecastNext7Days() over a synthetic series
 * of that length, so this exercises the actual gate + band math, not a fake render.
 *
 * Self-styled to match the /dev kitchen-sink aesthetic (dark, not the app theme).
 */
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useDevForecastOverride } from '../../services/dev/forecastOverride';

const PRESETS: { label: string; sessions: number | null; hint: string }[] = [
  { label: 'Off (real data)', sessions: null, hint: 'use the real session count' },
  { label: 'Cold', sessions: 0, hint: '0 sessions → learning badge, no graph' },
  { label: 'Warming', sessions: 8, hint: '8 sessions → wide band · confidence low' },
  { label: 'Mature', sessions: 16, hint: '16 sessions → tight band · confidence high' },
];

export function ForecastStatesPanel() {
  const override = useDevForecastOverride((s) => s.sessionsOverride);
  const setOverride = useDevForecastOverride((s) => s.setSessionsOverride);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Forecast states (S5.2)</Text>
      <Text style={styles.current}>
        override: {override == null ? 'off' : `${override} sessions`}
      </Text>

      {PRESETS.map((p) => {
        const active = override === p.sessions;
        return (
          <Pressable
            key={p.label}
            onPress={() => setOverride(p.sessions)}
            style={[styles.row, active && styles.rowActive]}
          >
            <Text style={[styles.rowLabel, active && styles.rowLabelActive]}>{p.label}</Text>
            <Text style={styles.rowHint}>{p.hint}</Text>
          </Pressable>
        );
      })}

      <Pressable onPress={() => router.push('/(tabs)/stats')} style={styles.go}>
        <Text style={styles.goText}>Open Stats →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  content: { padding: 16, gap: 10 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  current: { color: '#9ca3af', fontSize: 13, marginBottom: 6 },
  row: { padding: 14, borderRadius: 10, backgroundColor: '#1f2937', gap: 3 },
  rowActive: { backgroundColor: '#0F8B8D' },
  rowLabel: { color: '#e5e7eb', fontSize: 15, fontWeight: '600' },
  rowLabelActive: { color: '#fff' },
  rowHint: { color: '#9ca3af', fontSize: 12 },
  go: { marginTop: 10, padding: 14, borderRadius: 10, backgroundColor: '#3b82f6', alignItems: 'center' },
  goText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
