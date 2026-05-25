/**
 * Sign-up screen (S2.0). Display name + email + password, zod-validated with
 * inline errors. On success, creates the account (writes the users/{uid}
 * skeleton via auth.ts) and routes to onboarding Q1 to collect the seed.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { AuthShell } from '../../components/auth/AuthShell';
import { authErrorMessage } from '../../components/auth/errors';
import { fieldErrors, signUpSchema } from '../../components/auth/schemas';
import { Button, Text, TextField } from '../../components/ui';
import { signUp } from '../../services/firebase';
import { useTheme } from '../../theme';

export default function SignUp() {
  const theme = useTheme();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setFormError(null);
    const result = signUpSchema.safeParse({ displayName, email, password });
    if (!result.success) {
      setErrors(fieldErrors(result.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await signUp({
        email: result.data.email,
        password: result.data.password,
        displayName: result.data.displayName,
      });
      router.replace('/(onboarding)/q1'); // new account → onboarding seed
    } catch (e) {
      setFormError(authErrorMessage(e, 'sign-up'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="A few seconds to set up, then four quick questions."
      footer={
        <Pressable accessibilityRole="button" onPress={() => router.replace('/(auth)/sign-in')}>
          <Text variant="label" color={theme.textMuted}>
            Already have an account?{' '}
            <Text variant="label" color={theme.accent}>
              Sign in
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
        label="Name"
        value={displayName}
        onChangeText={setDisplayName}
        error={errors.displayName}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        placeholder="What should we call you?"
      />
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="you@example.com"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
        placeholder="At least 8 characters"
      />
      <Button label="Create account" onPress={onSubmit} loading={busy} />
    </AuthShell>
  );
}
