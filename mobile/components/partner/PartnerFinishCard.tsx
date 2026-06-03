/**
 * "What your partner did" card (S7.3) — surfaced on Home when the partner has
 * finished a session you haven't acknowledged yet. In-app only (no remote push
 * this week); shows once per session, then dismisses. Tapping it opens the
 * Partner tab (to react) and marks it seen; the ✕ just marks it seen.
 *
 * Self-hiding: renders nothing when solo, muted, or there's nothing new — safe
 * to mount unconditionally at the top of Home.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Card, Text } from '../ui';
import { useTheme } from '../../theme';
import { usePartnerFinishCard } from '../../services/partner/finishCard';

export function PartnerFinishCard() {
  const theme = useTheme();
  const { card, dismiss } = usePartnerFinishCard();
  if (!card) return null;

  const open = () => {
    dismiss();
    router.navigate('/partner');
  };

  return (
    <Pressable onPress={open} accessibilityRole="button" accessibilityLabel={`${card.name} finished a session — open Partner`}>
      <Card style={[styles.card, { borderColor: theme.accent }]}>
        <View style={styles.textCol}>
          <Text variant="caption" color={theme.accent}>
            YOUR PARTNER FOCUSED
          </Text>
          <Text variant="bodyMedium">
            {card.name} finished a {card.minutes}-min session.
          </Text>
          <Text variant="caption" color={theme.textMuted}>
            Open Partner to send a reaction.
          </Text>
        </View>
        <Pressable
          onPress={dismiss}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={styles.close}
        >
          <Text variant="body" color={theme.textMuted}>
            ✕
          </Text>
        </Pressable>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  textCol: { flex: 1, gap: 2 },
  close: { padding: 2 },
});
