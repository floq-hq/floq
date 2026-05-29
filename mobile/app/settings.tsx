/**
 * Settings (S3.5). Modal screen (registered in app/_layout.tsx) reached from the
 * Home header gear. Hosts the background-during-session policy picker and the
 * Sign-out affordance (relocated here from the W3 Stats stub when S4.1 replaced
 * it with the real Stats screen). Future settings slot in between the two.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '../components/ui';
import { BackgroundPolicySetting } from '../components/settings/BackgroundPolicySetting';
import { signOut } from '../services/firebase';
import { useTheme } from '../theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text variant="title">Settings</Text>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close settings"
        >
          <Text variant="bodyMedium" color={theme.accent}>
            Done
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
        <BackgroundPolicySetting />
        <View style={styles.signOut}>
          <Button
            label="Sign out"
            variant="secondary"
            loading={signingOut}
            onPress={onSignOut}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  body: { gap: 24 },
  signOut: { marginTop: 8 },
});
