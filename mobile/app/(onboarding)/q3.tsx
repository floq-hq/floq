/**
 * Q3 — Time of day preference (S2.1 / onboarding.md). Segmented: morning /
 * afternoon / evening, stored as `onboarding.preferred_time` (feeds
 * `time_match_mod`). Commits to the draft on selection.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { QuestionScaffold } from '../../components/onboarding/QuestionScaffold';
import { SegmentedControl, type SegmentedControlOption } from '../../components/ui';
import { useOnboardingStore } from '../../stores/useOnboardingStore';
import type { OnboardingAnswers } from '../../services/onboarding';

type PreferredTime = OnboardingAnswers['preferred_time'];

const OPTIONS: SegmentedControlOption<PreferredTime>[] = [
  { label: 'Morning', value: 'morning' },
  { label: 'Afternoon', value: 'afternoon' },
  { label: 'Evening', value: 'evening' },
];

export default function Q3PreferredTime() {
  const saved = useOnboardingStore((s) => s.draft.preferred_time);
  const setAnswer = useOnboardingStore((s) => s.setAnswer);
  const [value, setValue] = useState<PreferredTime | undefined>(saved);

  function onChange(next: PreferredTime) {
    setValue(next);
    setAnswer('preferred_time', next);
  }

  return (
    <QuestionScaffold
      question="When are you sharpest?"
      onContinue={() => router.push('/(onboarding)/q4')}
      continueDisabled={value === undefined}
    >
      <SegmentedControl
        options={OPTIONS}
        // undefined before first pick renders as no selection (resolved by Continue gate)
        value={value as PreferredTime}
        onChange={onChange}
      />
    </QuestionScaffold>
  );
}
