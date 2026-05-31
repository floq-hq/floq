import { describe, expect, it } from 'vitest';

import { difficultyLabel } from '../difficulty';

describe('difficultyLabel', () => {
  it('buckets 1–2 as Easy', () => {
    expect(difficultyLabel(1)).toBe('Easy');
    expect(difficultyLabel(2)).toBe('Easy');
  });

  it('buckets 3 as Medium', () => {
    expect(difficultyLabel(3)).toBe('Medium');
  });

  it('buckets 4–5 as Hard', () => {
    expect(difficultyLabel(4)).toBe('Hard');
    expect(difficultyLabel(5)).toBe('Hard');
  });
});
