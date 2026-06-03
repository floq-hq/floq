import { describe, it, expect } from 'vitest';
import { derivePresence } from '../derivePresence';

const NOW = 1_000_000_000_000;
const MIN = 60_000;

describe('derivePresence', () => {
  it('null/undefined doc → idle', () => {
    expect(derivePresence(null, NOW)).toEqual({ state: 'idle' });
    expect(derivePresence(undefined, NOW)).toEqual({ state: 'idle' });
  });

  it('fresh focusing → focusing (carries phase)', () => {
    const r = derivePresence({ state: 'focusing', phase: 'flow', started_at: NOW - 10 * MIN }, NOW);
    expect(r).toEqual({ state: 'focusing', phase: 'flow' });
  });

  it('focusing past the 90+5 min window → idle', () => {
    expect(derivePresence({ state: 'focusing', started_at: NOW - 96 * MIN }, NOW).state).toBe('idle');
  });

  it('focusing with started_at in the future (skewed clock) → idle', () => {
    expect(derivePresence({ state: 'focusing', started_at: NOW + 5 * MIN }, NOW).state).toBe('idle');
  });

  it('focusing with no started_at → idle', () => {
    expect(derivePresence({ state: 'focusing' }, NOW).state).toBe('idle');
  });

  it('fresh just_finished → just_finished (carries score/minutes/phase)', () => {
    const r = derivePresence(
      { state: 'just_finished', ended_at: NOW - 5 * MIN, score: 80, minutes: 45, phase: 'recovery' },
      NOW,
    );
    expect(r).toEqual({ state: 'just_finished', score: 80, minutes: 45, phase: 'recovery' });
  });

  it('just_finished past the 30-min decay → idle', () => {
    expect(derivePresence({ state: 'just_finished', ended_at: NOW - 31 * MIN }, NOW).state).toBe('idle');
  });

  it('idle stored state → idle', () => {
    expect(derivePresence({ state: 'idle' }, NOW)).toEqual({ state: 'idle' });
  });
});
