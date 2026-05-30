/**
 * More tab — the app's account + settings hub, organized as a grouped row-menu
 * (WHOOP-style): a tappable profile header, then sectioned rows that each push a
 * focused sub-screen. Layout only — every row's logic lives in its sub-screen.
 *
 * Text discipline: row label names the thing, the one-line subtitle states the
 * value (not how-to). Less text, less friction — but still self-explanatory.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MenuRow,
  MenuSection,
  Text,
  UserIcon,
  SunIcon,
  TimerIcon,
  EyeIcon,
  InfoIcon,
  CapIcon,
} from '../../components/ui';
import { ProfileHeader } from '../../components/profile/ProfileHeader';
import { useTheme } from '../../theme';

export default function MoreTab() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text variant="title">More</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <ProfileHeader />

        <MenuSection title="Account & settings">
          <MenuRow Icon={UserIcon} label="My account" subtitle="Name, email, sign out" onPress={() => router.push('/account')} />
          <MenuRow Icon={SunIcon} label="Appearance" subtitle="Theme and display" onPress={() => router.push('/appearance')} />
          <MenuRow Icon={TimerIcon} label="Session" subtitle="What counts as a distraction" onPress={() => router.push('/session-settings')} />
          <MenuRow Icon={EyeIcon} label="Privacy" subtitle="What others can see" onPress={() => router.push('/privacy')} />
        </MenuSection>

        <MenuSection title="Support">
          <MenuRow Icon={InfoIcon} label="About" subtitle="How Floq works, version" onPress={() => router.push('/about')} />
          <MenuRow Icon={CapIcon} label="Tutorials" subtitle="Short guides to get the most out of Floq" badge="Soon" disabled />
        </MenuSection>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  header: { marginBottom: 16 },
  body: { gap: 28, paddingBottom: 32 },
});
