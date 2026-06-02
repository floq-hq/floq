/**
 * Install→pair seam (S7.0 F). Two ways in:
 *   1. Deep link `floq://pair?code=XYZ` (a friend with the app taps the shared
 *      link) → expo-router lands here with `code` pre-filled.
 *   2. One-time after onboarding (ready.tsx routes here, not straight to /home)
 *      → the single "Have an invite code?" field, with a clear escape.
 *
 * A cold install can't be deep-linked (the app isn't there yet), so the typed
 * 6-char code is the real carrier; the link is pre-fill only. Either way the
 * seam is fully skippable — "Skip — focus solo" → /home. Solo is NEVER blocked.
 */
import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '../components/ui';
import { InviteCodeField } from '../components/partner/InviteCodeField';
import { setPendingAcceptCode } from '../services/partner/localInvite';
import { useTheme } from '../theme';

export default function Pair() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { code } = useLocalSearchParams<{ code?: string }>();
  const initial = typeof code === 'string' && code.length > 0 ? code : undefined;

  // Persist a deep-link code so the explicit Retry survives a reload at an
  // offline seam (the field also persists on its own offline failure).
  useEffect(() => {
    if (initial) setPendingAcceptCode(initial);
  }, [initial]);

  const goHome = () => router.replace('/home');

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.bg, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text variant="title">Focus with a friend?</Text>
        <Text variant="body" color={theme.textMuted} style={styles.copy}>
          If someone sent you an invite code, enter it to pair instantly. No code
          yet? You can do this anytime from the Partner tab — solo works fully on
          its own.
        </Text>
        <InviteCodeField initialCode={initial} onPaired={goHome} />
      </ScrollView>
      <Button label="Skip — focus solo" variant="ghost" onPress={goHome} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  body: { flexGrow: 1, justifyContent: 'center', gap: 16 },
  copy: { marginBottom: 4 },
});
