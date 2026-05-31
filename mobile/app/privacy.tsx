/**
 * Privacy & data sub-screen. Two parts:
 *  1. The L23 telemetry consent toggle — the real opt-in (default OFF) that gates
 *     the anonymized training-sample upload (services/telemetry). Copy is verbatim
 *     from L23, deliberate about revocation: already-uploaded samples are anonymous
 *     and unlinkable, so turning it off only stops FUTURE sessions — stated plainly.
 *  2. The standing privacy reassurance (sessions + task names stay on-device; the
 *     partner-visibility consent is pairing-time, W7).
 */
import { ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useEffect } from 'react';
import { ScreenHeader, Text } from '../components/ui';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useTheme } from '../theme';

export default function PrivacyScreen() {
  const theme = useTheme();
  const consent = useSettingsStore((s) => s.settings.telemetryConsent);
  const setConsent = useSettingsStore((s) => s.setTelemetryConsent);
  const hydrated = useSettingsStore((s) => s.hydrated);
  const hydrate = useSettingsStore((s) => s.hydrate);

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScreenHeader title="Privacy & data" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
          <View style={styles.toggleRow}>
            <Text variant="bodyMedium" style={styles.toggleLabel}>
              Help improve Floq
            </Text>
            <Switch
              value={consent}
              onValueChange={setConsent}
              trackColor={{ true: theme.accent, false: theme.border }}
              accessibilityLabel="Share anonymized session data to improve Floq's timer"
            />
          </View>
          <Text variant="body" color={theme.textMuted}>
            {consent
              ? 'Help improve Floq’s timer — share anonymized session data. No task names ever leave your device.'
              : 'Already-shared data is anonymous and can’t be traced back to you. Turning this off stops future sessions from being shared.'}
          </Text>
        </View>

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
  card: { gap: 8, padding: 16, borderRadius: 8, borderWidth: 1 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  toggleLabel: { flex: 1 },
});
