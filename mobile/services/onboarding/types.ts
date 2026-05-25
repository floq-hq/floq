// Onboarding answer types (M2.2).
//
// `OnboardingAnswers` is the local source-of-truth shape: the four Q1–Q4 seed
// answers plus the completion time. Reuses the timer service's union types so
// the vocabulary stays single-sourced (no drift between onboarding and the
// cold-start formula that consumes it).

import type { DistractionLevel, OnboardingSeed, PreferredTime } from '../timer';

export type UseCase = OnboardingSeed['use_case']; // 'studying' | 'work' | 'creative' | 'coding'

export interface OnboardingAnswers {
  base_focus: number; // Q1 — slider 10–90, default 45
  distraction_level: DistractionLevel; // Q2 — easy / neutral / hard
  preferred_time: PreferredTime; // Q3 — morning / afternoon / evening
  use_case: UseCase; // Q4 — studying / work / creative / coding
  completed_at: number; // epoch ms (local). Firestore stores this as a Timestamp.
}
