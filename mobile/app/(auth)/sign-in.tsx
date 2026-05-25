/**
 * Sign-in screen (S2.0). Email + password, zod-validated with inline errors;
 * auth failures surface as a single calm message above the form.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { AuthShell } from '../../components/auth/AuthShell';
import { authErrorMessage } from '../../components/auth/errors';
import { fieldErrors, signInSchema } from '../../components/auth/schemas';
import { Button, Text, TextField } from '../../components/ui';
import { signInWithEmail } from '../../services/firebase';
import { useTheme } from '../../theme';

export default function SignIn() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const result = signInSchema.safeParse({ email, password });
    if (!result.success) {
      setErrors(fieldErrors(result.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await signInWithEmail(result.data.email, result.data.password);
      router.replace('/'); // gate decides onboarding vs home
    } catch (e) {
      setFormError(authErrorMessage(e, 'sign-in'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to pick up where you left off."
      footer={
        <Pressable accessibilityRole="button" onPress={() => router.replace('/(auth)/sign-up')}>
          <Text variant="label" color={theme.textMuted}>
            New to Floq?{' '}
            <Text variant="label" color={theme.accent}>
              Create an account
            </Text>
          </Text>
        </Pressable>
      }
    >
      {formError ? (
        <Text variant="caption" color={theme.danger}>
          {formError}
        </Text>
      ) : null}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        placeholder="you@example.com"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        placeholder="Your password"
      />
      <Button label="Sign in" onPress={onSubmit} loading={busy} />
    </AuthShell>
  );
}
