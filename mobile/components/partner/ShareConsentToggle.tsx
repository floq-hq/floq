/**
 * Share-consent toggle (S7.2) — the ONE pairing consent (L28).
 *
 * "Share your focus activity with [partner]?" — covers summaries + presence,
 * default-OFF, one tap, per-member (I control mine, they control theirs), fully
 * reversible. Flipping it ON is what lets my partner see my minutes / score /
 * live state (PartnerView lights up on their side; the rules gate it via
 * share_consent[me]). It does NOT request an OS notification permission — that's
 * decoupled and asked separately (notifSocialPrompt). Identity (my name) is
 * always visible to a partner regardless; this gates ACTIVITY only.
 */
import { StyleSheet, Switch, View } from 'react-native';
import { Text } from '../ui';
import { useTheme } from '../../theme';
import { useSetShareConsent, useShareConsent } from '../../services/partner/useShareConsent';

export function ShareConsentToggle({
  pairId,
  partnerName,
}: {
  pairId: string;
  partnerName: string;
}) {
  const theme = useTheme();
  const { data: shared } = useShareConsent(pairId);
  const { mutate: setShared } = useSetShareConsent(pairId);
  const on = shared ?? false;

  return (
    <View style={[styles.row, { borderColor: theme.border }]}>
      <View style={styles.text}>
        <Text variant="bodyMedium">Share your focus activity</Text>
        <Text variant="caption" color={theme.textMuted}>
          {on
            ? `${partnerName} can see your sessions and when you’re focusing. Your task names stay private.`
            : `Off — ${partnerName} can’t see your sessions yet. Turn on to share minutes, score, and live status.`}
        </Text>
      </View>
      <Switch
        value={on}
        onValueChange={(v) => setShared(v)}
        trackColor={{ true: theme.accent, false: theme.border }}
        accessibilityLabel={`Share your focus activity with ${partnerName}`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
});
