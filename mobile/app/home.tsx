/**
 * PLACEHOLDER — the real Home + bottom tabs are S2.3. Kept minimal but
 * functional: shows who's signed in and a Sign out, so the S2.0 auth loop
 * (sign in → land here → sign out → back to welcome) is testable end to end.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '../components/ui';
import { signOut, useCurrentUser } from '../services/firebase';
import { useTheme } from '../theme';

export default function HomePlaceholder() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useCurrentUser();
  const [busy, setBusy] = useState(false);

  async function onSignOut() {
    setBusy(true);
    try {
      await signOut();
      router.replace('/');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.bg,
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <View style={styles.center}>
        <Text variant="title">Home</Text>
        <Text variant="body" color={theme.textMuted} style={styles.copy}>
          Signed in as {user?.displayName ?? user?.email ?? 'you'}. The real Home and tabs
          arrive in S2.3.
        </Text>
      </View>
      <Button label="Sign out" variant="secondary" loading={busy} onPress={onSignOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  copy: { textAlign: 'center' },
});
