/** Session settings sub-screen — the leaving-a-session (background) policy. */
import { ScrollView, StyleSheet, View } from 'react-native';
import { ScreenHeader } from '../components/ui';
import { BackgroundPolicySetting } from '../components/settings/BackgroundPolicySetting';
import { useTheme } from '../theme';

export default function SessionSettingsScreen() {
  const theme = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScreenHeader title="Session" />
      <ScrollView contentContainerStyle={styles.body}>
        <BackgroundPolicySetting />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 24, paddingBottom: 32 },
});
