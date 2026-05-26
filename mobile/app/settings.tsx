/**
 * Settings (S3.5). Modal screen (registered in app/_layout.tsx) reached from the
 * Home header gear. Hosts the background-during-session policy picker for now;
 * future settings slot in below it in the same ScrollView.
 */
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/ui';
import { BackgroundPolicySetting } from '../components/settings/BackgroundPolicySetting';
import { useTheme } from '../theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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
});
