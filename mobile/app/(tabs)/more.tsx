/**
 * More tab — the app's settings / overflow surface. Hosts the background-during-
 * session policy picker and Sign-out. Previously a modal (app/settings.tsx)
 * reached from the Home gear; moved here when the 5-tab FloqTabBar nav landed
 * ("More" → Settings), so it's now a first-class tab rather than a pushed modal.
 * Future overflow items (about, feedback link, theme override) slot in here.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '../../components/ui';
import { BackgroundPolicySetting } from '../../components/settings/BackgroundPolicySetting';
import { signOut } from '../../services/firebase';
import { useTheme } from '../../theme';

export default function MoreTab() {
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
        <Text variant="title">More</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
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
  body: { gap: 24, paddingBottom: 24 },
  signOut: { marginTop: 8 },
});
