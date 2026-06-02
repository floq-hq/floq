/**
 * S7.0 — the invite side, pending state. Shows the 6-char code I minted, big and
 * legible, with Share (the recruiting action — "text them the code") and Cancel
 * (revokeInvite). The code is the carrier; the floq:// link is pre-fill only and
 * rides along in the share text.
 *
 * Non-blaming "waiting on a friend" framing — solo is never blocked, this is a
 * standing invitation, not a pending obligation.
 */
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, Text } from '../ui';
import { useTheme } from '../../theme';
import { revokeInvite, useCurrentUser } from '../../services/firebase';
import { clearMyInviteCode } from '../../services/partner/localInvite';
import { partnerKeys } from '../../services/partner/usePartnerStatus';

export function PendingInviteCard({ code }: { code: string }) {
  const theme = useTheme();
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const [cancelling, setCancelling] = useState(false);

  const link = `floq://pair?code=${code}`;

  async function onShare() {
    try {
      await Share.share({
        message: `Let's focus together on Floq. Open the app and enter my invite code: ${code}\n${link}`,
      });
    } catch {
      // user dismissed the share sheet — no-op
    }
  }

  async function onCancel() {
    setCancelling(true);
    try {
      await revokeInvite(code);
    } catch {
      // best-effort: even if the remote revoke fails, drop it locally so the UI
      // isn't stuck showing a code we no longer want to honor.
    } finally {
      clearMyInviteCode();
      await qc.invalidateQueries({ queryKey: partnerKeys.status(user?.uid) });
      setCancelling(false);
    }
  }

  return (
    <Card>
      <Text variant="caption" color={theme.textMuted}>
        WAITING ON A FRIEND
      </Text>
      <Text variant="display" style={styles.code} color={theme.accent} maxFontSizeMultiplier={1.3}>
        {code}
      </Text>
      <Text variant="caption" color={theme.textMuted} style={styles.hint}>
        Share this code — they enter it in Floq and you’re paired. Solo keeps
        working in the meantime; this just waits in the background.
      </Text>
      <View style={styles.actions}>
        <Button label="Share code" onPress={onShare} style={styles.action} />
        <Button
          label="Cancel invite"
          variant="secondary"
          onPress={onCancel}
          loading={cancelling}
          style={styles.action}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  code: { letterSpacing: 4, marginVertical: 8 },
  hint: { marginBottom: 12 },
  actions: { gap: 8 },
  action: {},
});
