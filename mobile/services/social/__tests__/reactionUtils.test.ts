import { describe, it, expect } from 'vitest';
import { isReactionCurrent } from '../reactionUtils';

const T = 1_700_000_000_000;

describe('isReactionCurrent', () => {
  it('true when the reaction anchors to the latest session (within tolerance)', () => {
    expect(isReactionCurrent(T, T)).toBe(true);
    expect(isReactionCurrent(T + 500, T)).toBe(true);
  });

  it('false for a stale reaction from an older session', () => {
    expect(isReactionCurrent(T - 60_000, T)).toBe(false);
  });

  it('false when the owner has no sessions', () => {
    expect(isReactionCurrent(T, null)).toBe(false);
    expect(isReactionCurrent(T, 0)).toBe(false);
  });

  it('respects a custom tolerance', () => {
    expect(isReactionCurrent(T + 5000, T, 10_000)).toBe(true);
    expect(isReactionCurrent(T + 5000, T, 1000)).toBe(false);
  });
});
