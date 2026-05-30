/**
 * Privacy sub-screen — read-only for now. Sessions + task names are private to
 * the user; the partner-visibility *consent* is pairing-time (W7 M7.0/S7.0), so
 * there's no global toggle here yet (a live switch would gate nothing). This
 * becomes the consent surface when partnerships land.
 */
import { ScrollView, StyleSheet, View } from 'react-native';
import { ScreenHeader, Text } from '../components/ui';
import { useTheme } from '../theme';

export default function PrivacyScreen() {
  const theme = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScreenHeader title="Privacy" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
          <Text variant="bodyMedium">Your data stays yours</Text>
          <Text variant="body" color={theme.textMuted}>
            Sessions and task names never leave your device to anyone else.
          </Text>
        </View>
        <View style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
          <Text variant="bodyMedium">Focus partners</Text>
          <Text variant="body" color={theme.textMuted}>
            When you pair with a partner, you&apos;ll choose what they can see — your task
            names always stay private.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 24, paddingBottom: 32, gap: 12 },
  card: { gap: 6, padding: 16, borderRadius: 8, borderWidth: 1 },
});
