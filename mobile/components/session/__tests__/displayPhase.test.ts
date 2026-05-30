import { describe, expect, it } from 'vitest';

import { displayPhase } from '../displayPhase';
import { phaseFor } from '../../../services/timer/phases';
import type { SessionPlan } from '../../../services/timer';

describe('displayPhase', () => {
  it('clamps recovery → flow (the overrun pill, audit #13)', () => {
    expect(displayPhase('recovery')).toBe('flow');
  });

  it('passes the other three phases through untouched', () => {
    expect(displayPhase('struggle')).toBe('struggle');
    expect(displayPhase('release')).toBe('release');
    expect(displayPhase('flow')).toBe('flow');
  });

  // The bug it fixes: phaseFor flips to 'recovery' at the suggested stop while
  // the user is still focusing — the pill must read 'flow' there, not 'recovery'.
  it('shows flow (not recovery) at/after the suggested stop', () => {
    const plan: SessionPlan = { focusMinutes: 50, breakMinutes: 11, regime: 'cold' };
    expect(phaseFor(50 * 60, plan)).toBe('recovery'); // frozen machine flips
    expect(displayPhase(phaseFor(50 * 60, plan))).toBe('flow'); // pill stays flow
    expect(displayPhase(phaseFor(80 * 60, plan))).toBe('flow'); // deep overrun
  });
});
