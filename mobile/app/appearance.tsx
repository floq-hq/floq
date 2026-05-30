/** Appearance sub-screen — theme picker (System / Light / Dark). */
import { ScrollView, StyleSheet, View } from 'react-native';
import { ScreenHeader } from '../components/ui';
import { ThemeSetting } from '../components/settings/ThemeSetting';
import { useTheme } from '../theme';

export default function AppearanceScreen() {
  const theme = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScreenHeader title="Appearance" />
      <ScrollView contentContainerStyle={styles.body}>
        <ThemeSetting />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 24, paddingBottom: 32 },
});
