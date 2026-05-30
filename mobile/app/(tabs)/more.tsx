/**
 * More tab — Account & Settings. Hosts the user profile (avatar, editable name,
 * email, joined, privacy), the app settings (appearance + leaving-a-session
 * policy), and Sign-out. Previously a settings-only modal (app/settings.tsx),
 * promoted to a first-class tab with the 5-tab FloqTabBar nav.
 *
 * No business logic here — the profile reads/writes live in ProfileSection
 * (via useUserProfile / updateDisplayName) and the setting pickers bind to their
 * own stores. This screen is layout only.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '../../components/ui';
import { ProfileSection } from '../../components/profile/ProfileSection';
import { ThemeSetting } from '../../components/settings/ThemeSetting';
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
        <Text variant="title">Account</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <ProfileSection />

        <View style={styles.divider}>
          <Text variant="heading" color={theme.textMuted}>
            Settings
          </Text>
        </View>

        <ThemeSetting />
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
  body: { gap: 28, paddingBottom: 32 },
  divider: { marginTop: 4 },
  signOut: { marginTop: 8 },
});
