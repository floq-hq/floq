/**
 * Welcome screen (S2.0). Hero wordmark + the two entry points.
 *
 * Per decisions.md L13, the live social provider is GOOGLE, not Apple — Apple
 * sign-in is deferred (its `auth.ts` stub throws, and the entitlement is held
 * back until the Apple Developer membership is active at W8). So this screen
 * offers "Continue with Google" + "Continue with email" rather than the Apple
 * button named in the (pre-L13) tasks.md spec.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '../../components/ui';
import { GoogleSignInCancelledError, signInWithGoogle } from '../../services/firebase';
import { useTheme } from '../../theme';

export default function Welcome() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onGoogle() {
    setError(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      router.replace('/'); // gate routes to onboarding or home
    } catch (e) {
      if (e instanceof GoogleSignInCancelledError) return; // dismissed — no-op
      setError('Could not continue with Google. Try email instead.');
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
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <View style={styles.hero}>
        <Text variant="display">
          fl
          <Text variant="display" color={theme.accent}>
            oq
          </Text>
        </Text>
        <Text variant="body" color={theme.textMuted} style={styles.tagline}>
          Deep work, measured.
        </Text>
      </View>

      <View style={styles.actions}>
        {error ? (
          <Text variant="caption" color={theme.danger} style={styles.error}>
            {error}
          </Text>
        ) : null}
        <Button label="Continue with Google" onPress={onGoogle} loading={busy} />
        <Button
          label="Continue with email"
          variant="secondary"
          onPress={() => router.push('/(auth)/sign-in')}
        />
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/(auth)/sign-up')}
          style={styles.footer}
        >
          <Text variant="label" color={theme.textMuted}>
            New to Floq?{' '}
            <Text variant="label" color={theme.accent}>
              Create an account
            </Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tagline: { marginTop: 8 },
  actions: { gap: 12 },
  error: { textAlign: 'center' },
  footer: { alignItems: 'center', paddingTop: 12 },
});
