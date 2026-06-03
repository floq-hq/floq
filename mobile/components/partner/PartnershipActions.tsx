/**
 * Partnership management (S7.3) — mute / remove / block.
 *
 *  • Mute  — reversible, silent. Tears down the live partner surface (presence +
 *    summary + the Home finish card) WITHOUT ending the partnership. Local only.
 *  • Remove — neutral, one-tap, re-pairable later (no scary confirm — per spec).
 *  • Block  — confirmed (this one's destructive + can't re-pair). To the other
 *    party a block is INDISTINGUISHABLE from a remove (the ended edge looks the
 *    same; the backend stamps blocked_by) — they're never told.
 *
 * Both remove and block call endPartnership (M-lane), which flips the edge to
 * `ended` and deletes both pointers → the partner's reads are revoked by the
 * rule. The own-pointer listener (usePartnerStatus) flips the tab to solo.
 *
 * Report (the App-Store 1.2 abuse path) is intentionally NOT here yet: it needs
 * a `reports` collection + rule + a reportPartner mutation (M7.3 backend, not
 * shipped). Wiring point is marked below so it drops in as a one-liner.
 */
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Text } from '../ui';
import { useTheme } from '../../theme';
import { blockPartner, removePartner, useCurrentUser } from '../../services/firebase';
import { partnerKeys } from '../../services/partner/usePartnerStatus';

export function PartnershipActions({
  partnerName,
  muted,
  onToggleMute,
}: {
  partnerName: string;
  muted: boolean;
  onToggleMute: (next: boolean) => void;
}) {
  const theme = useTheme();
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [busy, setBusy] = useState(false);

  async function end(block: boolean) {
    setBusy(true);
    try {
      await (block ? blockPartner() : removePartner());
    } catch {
      // best-effort: the own-pointer listener still flips the tab to solo on the
      // delete; a failed write just leaves the partnership for a retry.
    } finally {
      await qc.invalidateQueries({ queryKey: partnerKeys.status(user?.uid) });
      setBusy(false);
    }
  }

  function confirmBlock() {
    Alert.alert(
      `Block ${partnerName}?`,
      'They’ll no longer see your activity and won’t be able to pair with you again. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => void end(true) },
      ],
    );
  }

  // Report wiring point (S7.3): once Mohamed lands the `reports` rule +
  // reportPartner mutation, add a one-tap Report row here.

  return (
    <View style={styles.group}>
      <View style={[styles.row, { borderColor: theme.border }]}>
        <View style={styles.text}>
          <Text variant="bodyMedium">Mute {partnerName}</Text>
          <Text variant="caption" color={theme.textMuted}>
            {muted
              ? 'Their activity is hidden. You stay paired — flip back on anytime.'
              : 'Hide their presence and sessions. You stay paired; nothing is sent.'}
          </Text>
        </View>
        <Switch
          value={muted}
          onValueChange={onToggleMute}
          trackColor={{ true: theme.accent, false: theme.border }}
          accessibilityLabel={`Mute ${partnerName}`}
        />
      </View>

      <Button
        label="Remove partner"
        variant="secondary"
        onPress={() => void end(false)}
        loading={busy}
      />

      <Pressable
        onPress={confirmBlock}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Block ${partnerName}`}
        style={({ pressed }) => [styles.block, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text variant="bodyMedium" color={theme.danger}>
          Block {partnerName}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  text: { flex: 1, gap: 2 },
  block: { alignItems: 'center', paddingVertical: 12 },
});
