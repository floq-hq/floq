/** Notifications sub-screen — break + daily-start reminder preferences. */
import { ScrollView, StyleSheet, View } from 'react-native';
import { ScreenHeader } from '../components/ui';
import { NotificationSetting } from '../components/settings/NotificationSetting';
import { useTheme } from '../theme';

export default function NotificationsSettingsScreen() {
  const theme = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScreenHeader title="Notifications" />
      <ScrollView contentContainerStyle={styles.body}>
        <NotificationSetting />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 24, paddingBottom: 32 },
});
