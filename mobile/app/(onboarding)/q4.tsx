/**
 * Q4 — Use case (S2.1 / onboarding.md). Segmented: studying / work / creative /
 * coding, stored as `onboarding.use_case` (a system-prompt hint for the LLM task
 * classifier). Commits to the draft on selection; Continue moves to the ready
 * screen, which finalizes the seed.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { QuestionScaffold } from '../../components/onboarding/QuestionScaffold';
import { SegmentedControl, type SegmentedControlOption } from '../../components/ui';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import type { OnboardingAnswers } from '../../services/onboarding';

type UseCase = OnboardingAnswers['use_case'];

const OPTIONS: SegmentedControlOption<UseCase>[] = [
  { label: 'Studying', value: 'studying' },
  { label: 'Work', value: 'work' },
  { label: 'Creative', value: 'creative' },
  { label: 'Coding', value: 'coding' },
];

export default function Q4UseCase() {
  const saved = useOnboardingStore((s) => s.draft.use_case);
  const setAnswer = useOnboardingStore((s) => s.setAnswer);
  const [value, setValue] = useState<UseCase | undefined>(saved);

  function onChange(next: UseCase) {
    setValue(next);
    setAnswer('use_case', next);
  }

  return (
    <QuestionScaffold
      question="What do you mainly use this for?"
      onContinue={() => router.push('/(onboarding)/ready')}
      continueDisabled={value === undefined}
    >
      <SegmentedControl
        options={OPTIONS}
        // undefined before first pick renders as no selection (resolved by Continue gate)
        value={value as UseCase}
        onChange={onChange}
      />
    </QuestionScaffold>
  );
}
