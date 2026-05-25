// Onboarding → timer seed mapper (M2.2).
//
// Pure transform from stored OnboardingAnswers to the OnboardingSeed the
// cold-start formula reads. Imports timer TYPES only — never the reverse, so
// the timer service stays a pure, React-free, I/O-free leaf.
//
// `decay_weight` is derived here (not stored): the onboarding seed's influence
// decays linearly 1.0 → 0.0 over 14 days (shared/spec/timer.md). It is not read
// by computeColdStart today; it exists for the warming/mature regimes.

import type { OnboardingSeed } from '../timer';
import type { OnboardingAnswers } from './types';

const DECAY_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Linear seed decay: 1.0 at completion → 0.0 at 14 days, clamped to [0, 1]. */
export function decayWeight(completedAt: number, now: number = Date.now()): number {
  const elapsedDays = (now - completedAt) / DAY_MS;
  return Math.max(0, Math.min(1, 1 - elapsedDays / DECAY_DAYS));
}

/** Map stored answers to an OnboardingSeed, deriving the time-decayed weight. */
export function toOnboardingSeed(
  answers: OnboardingAnswers,
  now: number = Date.now(),
): OnboardingSeed {
  return {
    base_focus: answers.base_focus,
    distraction_level: answers.distraction_level,
    preferred_time: answers.preferred_time,
    use_case: answers.use_case,
    decay_weight: decayWeight(answers.completed_at, now),
  };
}
