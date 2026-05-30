/**
 * About sub-screen — app identity + "How Floq works" (re-surfaces the
 * first-session framing card in read-only mode) + a feedback slot for W8.
 */
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { MenuRow, MenuSection, ScreenHeader, Text, InfoIcon } from '../components/ui';
import { FirstSessionFramingCard } from '../components/FirstSessionFramingCard';
import { useTheme } from '../theme';

// App version. Tracks app.json `version` — expo-constants isn't a dependency, so
// this is a static mirror; bump it alongside app.json on release.
const APP_VERSION = '1.0.0';

export default function AboutScreen() {
  const theme = useTheme();
  const [howOpen, setHowOpen] = useState(false);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScreenHeader title="About" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.identity}>
          <Text variant="title">Floq</Text>
          <Text variant="caption" color={theme.textMuted}>
            A focus partner that learns your rhythm.
          </Text>
          <Text variant="caption" color={theme.textMuted}>
            {`Version ${APP_VERSION}`}
          </Text>
        </View>

        <MenuSection>
          <MenuRow
            Icon={InfoIcon}
            label="How Floq works"
            subtitle="The 4-step intro, anytime"
            onPress={() => setHowOpen(true)}
          />
          <MenuRow label="Send feedback" subtitle="Coming with the beta" badge="Soon" disabled />
        </MenuSection>
      </ScrollView>

      <FirstSessionFramingCard visible={howOpen} onDismiss={() => setHowOpen(false)} readOnly />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 24, paddingBottom: 32, gap: 28 },
  identity: { alignItems: 'center', gap: 4, paddingTop: 8 },
});
