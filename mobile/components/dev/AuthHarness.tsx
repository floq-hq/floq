import { useState } from 'react';
import {
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  signUp,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  useCurrentUser,
} from '../../services/firebase';

// Dev-only harness for verifying the M2.4 auth service on device BEFORE the real
// sign-in UI (Mustafa's S2.0) exists. Throwaway, like TFLiteSpike — plain RN, no
// design system. Lets us confirm: email sign-up writes the users/{uid} skeleton,
// email sign-in works, Google returns signed-in, and sign-out clears state.

export function AuthHarness() {
  const { user, initializing } = useCurrentUser();
  const [email, setEmail] = useState('test@floq.app');
  const [password, setPassword] = useState('test1234');
  const [displayName, setDisplayName] = useState('Test User');
  const [status, setStatus] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);

  const run = (label: string, fn: () => Promise<unknown>) => async () => {
    setError(null);
    setStatus(`${label}…`);
    try {
      await fn();
      setStatus(`${label} ✓`);
    } catch (e) {
      setStatus(`${label} ✗`);
      setError(e instanceof Error ? `${e.name}: ${e.message}` : String(e));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.box} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Auth harness — M2.4</Text>

      <Text style={styles.label}>Current user</Text>
      {initializing ? (
        <Text>initializing…</Text>
      ) : user ? (
        <View style={styles.user}>
          <Text>uid: {user.uid}</Text>
          <Text>email: {user.email ?? '—'}</Text>
          <Text>name: {user.displayName ?? '—'}</Text>
        </View>
      ) : (
        <Text>signed out</Text>
      )}

      <View style={styles.gap} />
      <Text style={styles.label}>Email / password</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="email"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="password (≥6 chars)"
      />
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="display name"
      />

      <View style={styles.gap} />
      <Button title="Sign up (email)" onPress={run('signUp', () => signUp({ email, password, displayName }))} />
      <View style={styles.gap} />
      <Button title="Sign in (email)" onPress={run('signInWithEmail', () => signInWithEmail(email, password))} />
      <View style={styles.gap} />
      <Button title="Sign in with Google" onPress={run('signInWithGoogle', () => signInWithGoogle())} />
      <View style={styles.gap} />
      <Button title="Sign out" onPress={run('signOut', () => signOut())} />

      <View style={styles.gap} />
      <Text style={styles.label}>Status</Text>
      <Text>{status}</Text>
      {error ? <Text style={styles.err}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  box: { gap: 4, padding: 16 },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  label: { fontWeight: '600', marginTop: 4 },
  user: { gap: 2, paddingVertical: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginVertical: 2,
  },
  gap: { height: 10 },
  err: { color: 'red', marginTop: 4 },
});
