/**
 * Ready screen (S2.1). Terminal step after Q4: finalize the seed (write the
 * complete blob to MMKV + mirror to Firestore, drop the draft) and land on Home.
 *
 * Finalizing here — rather than on Q4 — keeps the question screens navigation-only
 * and gives the write a natural place to show progress / retry. The local MMKV
 * write inside finalize is synchronous and happens before the Firestore mirror,
 * so the seed is safe even if the (awaited) mirror is slow; we only block Home on
 * a hard failure and offer a retry.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '../../components/ui';
import { useCurrentUser } from '../../services/firebase';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import { useTheme } from '../../theme';

export default function Ready() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useCurrentUser();
  const finalize = useOnboardingStore((s) => s.finalize);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onStart() {
    setError(null);
    setBusy(true);
    try {
      await finalize(user?.uid);
      router.replace('/home');
    } catch {
      setError('Couldn’t save your answers. Check your connection and try again.');
      setBusy(false);
    }
  }

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.bg, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.hero}>
        <Text variant="title">You’re all set.</Text>
        <Text variant="body" color={theme.textMuted} style={styles.copy}>
          We’ve tuned your first sessions to how you focus. Floq learns the rest
          from how you actually work.
        </Text>
      </View>

      <View style={styles.actions}>
        {error ? (
          <Text variant="caption" color={theme.danger} style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Button label="Start focusing" onPress={onStart} loading={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  copy: { textAlign: 'center' },
  actions: { gap: 12 },
  error: { textAlign: 'center' },
});
