/**
 * Q2 — Distraction tendency (S2.1 / onboarding.md). Segmented: easy / neutral /
 * hard, stored as `onboarding.distraction_level` (feeds `distraction_mod`). The
 * answer commits to the draft on selection, so it persists immediately.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { QuestionScaffold } from '../../components/onboarding/QuestionScaffold';
import { SegmentedControl, type SegmentedControlOption } from '../../components/ui';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import type { OnboardingAnswers } from '../../services/onboarding';

type Distraction = OnboardingAnswers['distraction_level'];

const OPTIONS: SegmentedControlOption<Distraction>[] = [
  { label: 'Easily', value: 'easy' },
  { label: 'Sometimes', value: 'neutral' },
  { label: 'Rarely', value: 'hard' },
];

export default function Q2Distraction() {
  const saved = useOnboardingStore((s) => s.draft.distraction_level);
  const setAnswer = useOnboardingStore((s) => s.setAnswer);
  const [value, setValue] = useState<Distraction | undefined>(saved);

  function onChange(next: Distraction) {
    setValue(next);
    setAnswer('distraction_level', next);
  }

  return (
    <QuestionScaffold
      question="How easily do you get distracted?"
      onContinue={() => router.push('/(onboarding)/q3')}
      continueDisabled={value === undefined}
    >
      <SegmentedControl
        options={OPTIONS}
        // undefined before first pick renders as no selection (resolved by Continue gate)
        value={value as Distraction}
        onChange={onChange}
      />
    </QuestionScaffold>
  );
}
