/**
 * Beat-1 "start one too?" surface (S7.2).
 *
 * Renders only when the partner is freshly live-focusing AND I'm not mid-session
 * (the parent gates this via shouldShowStartTogether). Framed as the recipient's
 * OWN prompt — an invitation to start MY session, never social pressure / a
 * blame. Tapping routes to the Session launchpad (where the start flow lives —
 * "Session tab = launchpad, /focus is full-screen"); the parent logs the
 * start_together funnel step.
 *
 * Reuses the presence the parent already subscribes to — no second listener
 * (presence stays a Partner-tab-only subscription per mobile/CLAUDE.md).
 */
import { StyleSheet } from 'react-native';
import { Button, Card, Text } from '../ui';
import { useTheme } from '../../theme';

export function StartTogetherPrompt({
  partnerName,
  onStart,
}: {
  partnerName: string;
  onStart: () => void;
}) {
  const theme = useTheme();
  return (
    <Card style={[styles.card, { borderColor: theme.accent }]}>
      <Text variant="caption" color={theme.accent}>
        {partnerName.toUpperCase()} IS FOCUSING NOW
      </Text>
      <Text variant="bodyMedium" style={styles.line}>
        Good time to start one too.
      </Text>
      <Button label="Start a session" onPress={onStart} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, gap: 12 },
  line: {},
});
