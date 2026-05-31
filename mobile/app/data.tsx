/**
 * Your data sub-screen — plain-language "what we collect" + a Clear-local-history
 * action. Clearing wipes the on-device session history, the local ML training
 * outbox, and the task queue (behind a confirm), then refreshes stats.
 *
 * Honest about the limit (L23): already-uploaded telemetry is anonymous and
 * unlinkable, so it can't be deleted — only local data clears here.
 */
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Button, ScreenHeader, Text } from '../components/ui';
import { useTheme } from '../theme';
import { deleteAllSessions } from '../services/storage/sessions';
import { deleteAllTrainingSamples } from '../services/storage/trainingOutbox';
import { useTaskStore } from '../stores/useTaskStore';
import { queryClient } from '../services/queryClient';
import { statsKeys } from '../services/stats/useStats';

function Card({ title, body }: { title: string; body: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
      <Text variant="bodyMedium">{title}</Text>
      <Text variant="body" color={theme.textMuted}>
        {body}
      </Text>
    </View>
  );
}

export default function DataScreen() {
  const theme = useTheme();
  const [clearing, setClearing] = useState(false);

  function clearLocalHistory() {
    setClearing(true);
    try {
      deleteAllSessions();
      deleteAllTrainingSamples();
      useTaskStore.getState().reset();
      void queryClient.invalidateQueries({ queryKey: statsKeys.all });
    } finally {
      setClearing(false);
    }
  }

  function confirmClear() {
    Alert.alert(
      'Clear local history?',
      'This permanently removes your sessions, stats, and task queue from this device. It can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearLocalHistory },
      ],
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScreenHeader title="Your data" />
      <ScrollView contentContainerStyle={styles.body}>
        <Card
          title="What stays on your device"
          body="Your sessions, focus scores, streaks, and task names live in this app on your device — and sync across your own devices when you’re signed in."
        />
        <Card
          title="What you can share"
          body="If you turn on “Help improve Floq” in Privacy & data, anonymized session metrics (never task names) are shared to improve the timer. It’s off by default."
        />
        <Card
          title="Already-shared data"
          body="Shared data is anonymous and can’t be traced back to you — so it can’t be deleted. Turning sharing off stops future sessions from being shared."
        />

        <View style={styles.action}>
          <Button
            label="Clear local history"
            variant="secondary"
            loading={clearing}
            onPress={confirmClear}
          />
          <Text variant="caption" color={theme.textMuted} style={styles.actionNote}>
            Removes sessions, stats, and tasks from this device.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 24, paddingBottom: 32, gap: 12 },
  card: { gap: 6, padding: 16, borderRadius: 8, borderWidth: 1 },
  action: { marginTop: 12, gap: 8 },
  actionNote: { textAlign: 'center' },
});
