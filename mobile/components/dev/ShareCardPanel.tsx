/**
 * Dev harness — open the shareable session card (S6.0) with sample sessions of
 * different lengths, so the full Struggle → Release → Flow curve, the
 * Curve ⇄ Minimal toggle, and the share overlay can be eyeballed without logging
 * real sessions. Dev-only (reachable at /dev); never linked from the app UI.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from '../ui';
import { useTheme } from '../../theme';
import { SessionCardModal } from '../session/SessionCardModal';
import type { SessionCardData } from '../../services/share/sessionInsight';

/** A fixed morning timestamp so the time-of-day insight reads "morning". */
function morningTs(): number {
  const d = new Date();
  d.setHours(9, 12, 0, 0);
  return d.getTime();
}

const PRESETS: { label: string; data: SessionCardData }[] = [
  {
    label: 'Deep session · 52 min',
    data: { focusScore: 84, focusMinutes: 52, distractionCount: 1, startedAt: morningTs() },
  },
  {
    label: 'Long + distractions · 68 min',
    data: { focusScore: 71, focusMinutes: 68, distractionCount: 3, startedAt: morningTs() },
  },
  {
    label: 'Just reached Flow · 24 min',
    data: { focusScore: 58, focusMinutes: 24, distractionCount: 0, startedAt: morningTs() },
  },
  {
    label: 'Short · 16 min (struggle only)',
    data: { focusScore: 33, focusMinutes: 16, distractionCount: 0, startedAt: morningTs() },
  },
  {
    label: 'Rough · negative score',
    data: { focusScore: -14, focusMinutes: 30, distractionCount: 5, startedAt: morningTs() },
  },
];

export function ShareCardPanel() {
  const theme = useTheme();
  const [card, setCard] = useState<SessionCardData | null>(null);
  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="caption" color={theme.textMuted}>
          Open the share card with a sample session — then toggle Curve ⇄ Minimal.
        </Text>
        {PRESETS.map((p) => (
          <Button
            key={p.label}
            label={p.label}
            variant="secondary"
            onPress={() => setCard(p.data)}
          />
        ))}
      </ScrollView>
      <SessionCardModal data={card} onClose={() => setCard(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, paddingTop: 32, gap: 12 },
});
