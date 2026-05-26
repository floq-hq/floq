/**
 * Stats tab — PLACEHOLDER. The weekly focus score, performance graph, and
 * regime-gated forecast are W4 (S4.x).
 *
 * Temporarily hosts Sign out so the S2.0 auth loop stays testable end-to-end
 * (sign in → use app → sign out → welcome). This moves to a proper profile /
 * settings surface later — it's not the Stats screen's real home.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '../../components/ui';
import { signOut } from '../../services/firebase';
import { useTheme } from '../../theme';

export default function StatsTab() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
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
        { backgroundColor: theme.bg, paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.center}>
        <Text variant="title">Stats</Text>
        <Text variant="body" color={theme.textMuted} style={styles.copy}>
          Weekly focus score and your performance graph arrive in W4.
        </Text>
      </View>
      {/* Temporary — relocates to Settings/profile later. */}
      <Button label="Sign out" variant="secondary" loading={busy} onPress={onSignOut} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  copy: { textAlign: 'center' },
});
