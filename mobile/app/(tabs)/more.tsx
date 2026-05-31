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
  ScrollFade,
  UserIcon,
  SunIcon,
  TimerIcon,
  BellIcon,
  EyeIcon,
  DatabaseIcon,
  InfoIcon,
  CapIcon,
} from '../../components/ui';
import { ProfileHeader } from '../../components/profile/ProfileHeader';
import { TabHeader, TAB_PADDING, tabHeaderTopPadding } from '../../components/TabHeader';
import { useTheme } from '../../theme';

export default function MoreTab() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingTop: tabHeaderTopPadding(insets.top) }]}>
      <TabHeader title="More" />

      <View style={styles.scrollWrap}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
          <ProfileHeader />

        <MenuSection title="Account">
          <MenuRow Icon={UserIcon} label="My account" subtitle="Name, email, sign out" onPress={() => router.push('/account')} />
        </MenuSection>

        <MenuSection title="Preferences">
          <MenuRow Icon={SunIcon} label="Appearance" subtitle="Theme and display" onPress={() => router.push('/appearance')} />
          <MenuRow Icon={TimerIcon} label="Session" subtitle="What counts as a distraction" onPress={() => router.push('/session-settings')} />
          <MenuRow Icon={BellIcon} label="Notifications" subtitle="Break and daily reminders" onPress={() => router.push('/notifications-settings')} />
        </MenuSection>

        <MenuSection title="Data & privacy">
          <MenuRow Icon={EyeIcon} label="Privacy & data" subtitle="Sharing and what others can see" onPress={() => router.push('/privacy')} />
          <MenuRow Icon={DatabaseIcon} label="Your data" subtitle="What we collect, clear history" onPress={() => router.push('/data')} />
        </MenuSection>

        <MenuSection title="About">
          <MenuRow Icon={InfoIcon} label="About" subtitle="How Floq works, version" onPress={() => router.push('/about')} />
          <MenuRow Icon={CapIcon} label="Tutorials" subtitle="Short guides to get the most out of Floq" badge="Soon" disabled />
        </MenuSection>
        </ScrollView>
        <ScrollFade edge="top" color={theme.bg} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: TAB_PADDING },
  scrollWrap: { flex: 1 },
  scroll: { flex: 1 },
  // paddingTop clears the ~28px top ScrollFade so the first card (the profile
  // header) isn't washed over by the fade at rest. See decisions.md L26.
  body: { gap: 28, paddingTop: 28, paddingBottom: 32 },
});
