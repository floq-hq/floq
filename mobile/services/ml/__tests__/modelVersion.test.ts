import { describe, expect, it } from 'vitest';

import { MODEL_VERSION, modelVersionFor } from '../modelVersion';

describe('modelVersionFor', () => {
  it('always returns a non-empty provenance tag per regime (no dirty data, L23)', () => {
    expect(modelVersionFor('cold')).toBe('formula-v1');
    expect(modelVersionFor('warming')).toBe('warming-v1');
    expect(modelVersionFor('mature')).toBe(MODEL_VERSION);
  });

  it('MODEL_VERSION is v1 (drift guard)', () => {
    expect(MODEL_VERSION).toBe('v1');
  });
});
