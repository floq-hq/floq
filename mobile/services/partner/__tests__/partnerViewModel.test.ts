import { describe, expect, it } from 'vitest';
import {
  asPhase,
  canReact,
  formatWhen,
  presenceDisplay,
  shouldShowStartTogether,
} from '../partnerViewModel';
import type { DerivedPresence } from '../../presence/derivePresence';

describe('presenceDisplay', () => {
  it('focusing renders a phase-tinted chip with the live phase word', () => {
    const d = presenceDisplay({ state: 'focusing', phase: 'flow' });
    expect(d.visible).toBe(true);
    expect(d.phase).toBe('flow');
    expect(d.label).toContain('Focusing now');
    expect(d.label).toContain('in flow');
  });

  it('focusing without a phase falls back to flow (never crashes the color lookup)', () => {
    const d = presenceDisplay({ state: 'focusing' } as DerivedPresence);
    expect(d.phase).toBe('flow');
    expect(d.visible).toBe(true);
  });

  it('just_finished is a neutral (no-phase) chip', () => {
    const d = presenceDisplay({ state: 'just_finished', minutes: 25, score: 80 });
    expect(d.visible).toBe(true);
    expect(d.phase).toBeNull();
    expect(d.label).toMatch(/just finished/i);
  });

  it('idle is silent — no chip', () => {
    const d = presenceDisplay({ state: 'idle' });
    expect(d.visible).toBe(false);
    expect(d.label).toBe('');
  });
});

describe('formatWhen', () => {
  const now = 1_000_000_000_000;
  it('buckets into just now / minutes / hours / days', () => {
    expect(formatWhen(now, now)).toBe('just now');
    expect(formatWhen(now - 30_000, now)).toBe('just now');
    expect(formatWhen(now - 3 * 60_000, now)).toBe('3m ago');
    expect(formatWhen(now - 2 * 3_600_000, now)).toBe('2h ago');
    expect(formatWhen(now - 25 * 3_600_000, now)).toBe('1d ago');
  });

  it('never goes negative on a future timestamp (skewed partner clock)', () => {
    expect(formatWhen(now + 60_000, now)).toBe('just now');
  });
});

describe('canReact', () => {
  it('requires a real positive end time', () => {
    expect(canReact(1_700_000_000_000)).toBe(true);
    expect(canReact(0)).toBe(false);
    expect(canReact(null)).toBe(false);
    expect(canReact(undefined)).toBe(false);
  });
});

describe('shouldShowStartTogether', () => {
  it('shows only when the partner is focusing AND I am not mid-session', () => {
    expect(shouldShowStartTogether({ state: 'focusing', phase: 'flow' }, false)).toBe(true);
  });
  it('hidden when I am already in a session (the focused middle is sacred)', () => {
    expect(shouldShowStartTogether({ state: 'focusing', phase: 'flow' }, true)).toBe(false);
  });
  it('hidden when the partner is idle or just finished (silent otherwise)', () => {
    expect(shouldShowStartTogether({ state: 'idle' }, false)).toBe(false);
    expect(shouldShowStartTogether({ state: 'just_finished' }, false)).toBe(false);
  });
});

describe('asPhase', () => {
  it('passes through valid phases', () => {
    expect(asPhase('struggle')).toBe('struggle');
    expect(asPhase('recovery')).toBe('recovery');
  });
  it('defaults unknown / missing to flow', () => {
    expect(asPhase('bogus')).toBe('flow');
    expect(asPhase(null)).toBe('flow');
    expect(asPhase(undefined)).toBe('flow');
  });
});
