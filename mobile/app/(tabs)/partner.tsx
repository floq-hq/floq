/**
 * Partner tab (S7.0) — the always-available pairing surface + activation funnel.
 *
 * Per L18 (social-as-core): NOT a friend list / leaderboard (both dead). One
 * focus partner, invited by a 6-char code. Solo is NEVER blocked — this tab is
 * a calm, optional on-ramp, never a dead end.
 *
 * A 3-state machine off usePartnerStatus():
 *   solo        → invite a friend (createInvite) + enter a code (InviteCodeField)
 *                 + the non-inert "I want a partner" intent toggle
 *   pendingSent → the minted code, shareable, cancellable (PendingInviteCard)
 *   paired      → the partner view: live presence + last-session summary + a
 *                 one-tap reaction (PartnerView, S7.1)
 *
 * The pairing-consent prompt + beat-1 "start one too?" surface are S7.2;
 * the inbound finish card + mute/remove/block are S7.3.
 */
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Text } from '../../components/ui';
import { TabHeader, TAB_PADDING, tabHeaderTopPadding } from '../../components/TabHeader';
import { InviteCodeField } from '../../components/partner/InviteCodeField';
import { PendingInviteCard } from '../../components/partner/PendingInviteCard';
import { PartnerView } from '../../components/partner/PartnerView';
import { createInvite, useCurrentUser } from '../../services/firebase';
import { setMyInviteCode, getWantPartner, setWantPartner } from '../../services/partner/localInvite';
import { partnerKeys, usePartnerStatus } from '../../services/partner/usePartnerStatus';
import { useTheme } from '../../theme';

export default function PartnerTab() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const { user } = useCurrentUser();
  const { data: status, isLoading } = usePartnerStatus();

  const [creating, setCreating] = useState(false);
  const [wantPartner, setWant] = useState(getWantPartner);

  async function onCreateInvite() {
    setCreating(true);
    try {
      const { code } = await createInvite();
      setMyInviteCode(code);
      await qc.invalidateQueries({ queryKey: partnerKeys.status(user?.uid) });
    } catch {
      // best-effort; a failed mint just leaves the user in solo to retry.
    } finally {
      setCreating(false);
    }
  }

  function toggleWant(next: boolean) {
    setWant(next);
    setWantPartner(next);
  }

  return (
    <View style={[styles.root, { paddingTop: tabHeaderTopPadding(insets.top) }]}>
      <TabHeader title="Partner" />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {isLoading || !status ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.accent} />
          </View>
        ) : status.state === 'paired' ? (
          <PartnerView
            partnerUid={status.partnerUid}
            pairId={status.pairId}
            fallbackName={status.partnerName}
          />
        ) : status.state === 'pendingSent' ? (
          <PendingInviteCard code={status.code} />
        ) : (
          // solo
          <>
            <Text variant="body" color={theme.textMuted} style={styles.intro}>
              Focus is better with someone in it with you. Pair with one person —
              you’ll see each other’s sessions and keep a shared streak. Solo
              stays exactly as it is.
            </Text>

            <Button label="Invite a friend" onPress={onCreateInvite} loading={creating} />

            <View style={styles.dividerRow}>
              <View style={[styles.rule, { backgroundColor: theme.border }]} />
              <Text variant="caption" color={theme.textMuted}>
                or
              </Text>
              <View style={[styles.rule, { backgroundColor: theme.border }]} />
            </View>

            <InviteCodeField />

            <View style={[styles.wantRow, { borderColor: theme.border }]}>
              <View style={styles.wantText}>
                <Text variant="bodyMedium">I want a partner</Text>
                <Text variant="caption" color={theme.textMuted}>
                  We’ll help you find one. Nothing here blocks solo.
                </Text>
              </View>
              <Switch
                value={wantPartner}
                onValueChange={toggleWant}
                trackColor={{ true: theme.accent, false: theme.border }}
              />
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: TAB_PADDING },
  content: { gap: 16, paddingBottom: 32 },
  center: { paddingVertical: 48, alignItems: 'center' },
  intro: {},
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  wantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
  },
  wantText: { flex: 1, gap: 2 },
});
