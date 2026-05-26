/**
 * Q1 — Focus duration (S2.1 / onboarding.md). Slider 10–90 min, default 45,
 * 5-min snap. Stored as `onboarding.base_focus`; feeds the cold-start formula
 * directly. The value commits to the draft on Continue (advancing the flow),
 * which is also what persists it for resume-on-kill.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { QuestionScaffold } from '../../components/onboarding/QuestionScaffold';
import { Slider, Text } from '../../components/ui';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import { useTheme } from '../../theme';

const DEFAULT_MINUTES = 45;

export default function Q1FocusDuration() {
  const theme = useTheme();
  const saved = useOnboardingStore((s) => s.draft.base_focus);
  const setAnswer = useOnboardingStore((s) => s.setAnswer);
  const [minutes, setMinutes] = useState(saved ?? DEFAULT_MINUTES);

  function onContinue() {
    setAnswer('base_focus', minutes);
    router.push('/(onboarding)/q2');
  }

  return (
    <QuestionScaffold
      question="How long can you focus before your mind wanders?"
      helper="Drag to set your typical focus stretch. You can change this later."
      onContinue={onContinue}
    >
      <View style={styles.readout}>
        <Text variant="display">{minutes}</Text>
        <Text variant="body" color={theme.textMuted}>
          minutes
        </Text>
      </View>
      <Slider
        value={minutes}
        onValueChange={setMinutes}
        minimumValue={10}
        maximumValue={90}
        step={5}
      />
      <View style={styles.bounds}>
        <Text variant="caption" color={theme.textMuted}>
          10 min
        </Text>
        <Text variant="caption" color={theme.textMuted}>
          90 min
        </Text>
      </View>
    </QuestionScaffold>
  );
}

const styles = StyleSheet.create({
  readout: { alignItems: 'center', gap: 4 },
  bounds: { flexDirection: 'row', justifyContent: 'space-between' },
});
