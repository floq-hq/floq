/**
 * Onboarding partner step / install→pair seam (S7.0 F + S7.4).
 *
 * Three ways forward, all from one screen so time-to-first-partner is minimal —
 * no need to discover the Partner tab later:
 *   1. Invite a friend — mint a code (createInvite) + Share it (the recruiting
 *      action). Lands invite-PENDING; "Continue" → /home with the invite waiting
 *      in the background. (S7.4)
 *   2. Have an invite code? — enter it (InviteCodeField → acceptInvite) → paired
 *      → /home. Pre-filled from a `floq://pair?code=XYZ` deep link. (S7.0)
 *   3. Skip — focus solo → /home. Solo is NEVER blocked; this logs the `skip`
 *      funnel step so the recruit tally can separate declines from non-asks.
 *
 * A cold install can't be deep-linked (the app isn't there yet), so the typed
 * 6-char code is the real carrier; the link is pre-fill only.
 */
import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Share, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '../components/ui';
import { InviteCodeField } from '../components/partner/InviteCodeField';
import { createInvite } from '../services/firebase';
import { logEvent } from '../services/analytics/logEvent';
import {
  inviteShareMessage,
  setMyInviteCode,
  setPendingAcceptCode,
} from '../services/partner/localInvite';
import { useTheme } from '../theme';

export default function Pair() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const initial = typeof code === 'string' && code.length > 0 ? code : undefined;

  const [creating, setCreating] = useState(false);
  // The code I just minted — switches the screen to the "share it" state.
  const [myCode, setMyCode] = useState<string | null>(null);

  // Persist a deep-link code so the explicit Retry survives a reload at an
  // offline seam (the field also persists on its own offline failure).
  useEffect(() => {
    if (initial) setPendingAcceptCode(initial);
  }, [initial]);

  const goHome = () => router.replace('/home');
  const onSkip = () => {
    logEvent('skip'); // M7.recruit funnel: an explicit decline, not a non-ask
    goHome();
  };

  async function onInvite() {
    setCreating(true);
    try {
      const { code: minted } = await createInvite(); // logs invite_created
      setMyInviteCode(minted); // → Partner tab shows the pending invite
      setMyCode(minted);
    } catch {
      // best-effort: a failed mint just leaves the choose view to retry.
    } finally {
      setCreating(false);
    }
  }

  async function onShare() {
    if (!myCode) return;
    try {
      await Share.share({ message: inviteShareMessage(myCode) });
    } catch {
      // user dismissed the share sheet — no-op
    }
  }

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {myCode ? (
          // Invite-pending: the minted code, ready to send.
          <>
            <Text variant="title">Share your invite code</Text>
            <Text variant="body" color={theme.textMuted} style={styles.copy}>
              Text this to one person. They enter it in Floq and you’re paired. You
              can start focusing now — this just waits in the background.
            </Text>
            <Text
              variant="display"
              color={theme.accent}
              style={styles.code}
              maxFontSizeMultiplier={1.3}
            >
              {myCode}
            </Text>
            <Button label="Share code" onPress={onShare} />
          </>
        ) : (
          <>
            <Text variant="title">Focus with someone?</Text>
            <Text variant="body" color={theme.textMuted} style={styles.copy}>
              Pair with one person — you’ll see each other’s sessions and keep a
              shared streak. Solo works fully on its own.
            </Text>

            <Button label="Invite a friend" onPress={onInvite} loading={creating} />

            <View style={styles.dividerRow}>
              <View style={[styles.rule, { backgroundColor: theme.border }]} />
              <Text variant="caption" color={theme.textMuted}>
                or
              </Text>
              <View style={[styles.rule, { backgroundColor: theme.border }]} />
            </View>

            <InviteCodeField initialCode={initial} onPaired={goHome} />
          </>
        )}
      </ScrollView>

      <Button
        label={myCode ? 'Continue' : 'Skip — focus solo'}
        variant={myCode ? 'primary' : 'ghost'}
        onPress={myCode ? goHome : onSkip}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  body: { flexGrow: 1, justifyContent: 'center', gap: 16 },
  copy: { marginBottom: 4 },
  code: { letterSpacing: 4, textAlign: 'center', marginVertical: 4 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
});
