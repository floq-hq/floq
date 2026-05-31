// Difficulty → human label (Home redesign, M-side helper).
//
// The queue stores difficulty as 1–5 (the cold-start formula's input), but the
// UI should never surface a raw "3/5" — it reads as a rating, not a property of
// the work. This is the single source for the Easy/Medium/Hard bucketing so the
// UP NEXT card, the queue sheet, and any future surface stay consistent.
//
// Pure, zero React. Buckets per the Home brief: 1–2 Easy / 3 Medium / 4–5 Hard.

import type { Difficulty } from './types';

export type DifficultyLabel = 'Easy' | 'Medium' | 'Hard';

export function difficultyLabel(difficulty: Difficulty): DifficultyLabel {
  if (difficulty <= 2) return 'Easy';
  if (difficulty === 3) return 'Medium';
  return 'Hard';
}
