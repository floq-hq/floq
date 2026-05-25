/**
 * PLACEHOLDER — the real onboarding Q1–Q4 is S2.1. This exists only so S2.0's
 * post-sign-up navigation has a real target. The temporary "Skip to Home" keeps
 * the flow from dead-ending while S2.1 is unbuilt; delete it when S2.1 lands.
 */
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '../../components/ui';
import { useTheme } from '../../theme';

export default function OnboardingQ1Placeholder() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.bg,
          paddingTop: insets.top + 56,
          paddingBottom: insets.bottom + 24,
        },
      ]}
    >
      <View style={styles.center}>
        <Text variant="title">Onboarding</Text>
        <Text variant="body" color={theme.textMuted} style={styles.copy}>
          The four seed questions (Q1–Q4) land here in S2.1.
        </Text>
      </View>
      <Button
        label="Skip to Home (temp)"
        variant="secondary"
        onPress={() => router.replace('/home')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  copy: { textAlign: 'center' },
});
