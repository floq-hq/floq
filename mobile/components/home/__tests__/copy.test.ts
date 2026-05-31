import { describe, expect, it } from 'vitest';

import type { NowContext } from '../../../services/session/nowContext';
import {
  formatLastSession,
  greeting,
  pluralize,
  regimeLabel,
  restedClause,
  windowClause,
} from '../copy';

const ctx = (over: Partial<NowContext> = {}): NowContext => ({
  bucket: 'morning',
  onWindow: true,
  rested: true,
  recoveryMod: 1,
  ...over,
});

describe('regimeLabel', () => {
  it('names each regime', () => {
    expect(regimeLabel('cold')).toBe('Learning your rhythm');
    expect(regimeLabel('warming')).toBe('Tuning to you');
    expect(regimeLabel('mature')).toBe('Dialed in');
  });
});

describe('greeting', () => {
  const at = (h: number): number => new Date(2026, 4, 26, h, 0, 0).getTime();
  it('picks the time-of-day greeting', () => {
    expect(greeting(at(8))).toBe('Good morning');
    expect(greeting(at(13))).toBe('Good afternoon');
    expect(greeting(at(19))).toBe('Good evening');
    expect(greeting(at(23))).toBe('Good evening'); // night folds into evening
  });
});

describe('windowClause', () => {
  it('calls it prime focus time when on-window', () => {
    expect(windowClause(ctx({ onWindow: true }))).toBe('Prime focus time.');
  });

  it('is a neutral note when off-window (never a scold)', () => {
    expect(windowClause(ctx({ onWindow: false }))).toBe('Outside your usual window.');
  });
});

describe('restedClause', () => {
  it('reflects recovery', () => {
    expect(restedClause(ctx({ rested: true }))).toBe('Rested.');
    expect(restedClause(ctx({ rested: false }))).toBe('Still recovering.');
  });
});

describe('pluralize', () => {
  it('pluralizes by count', () => {
    expect(pluralize(1, 'session')).toBe('1 session');
    expect(pluralize(2, 'session')).toBe('2 sessions');
    expect(pluralize(0, 'distraction')).toBe('0 distractions');
  });
});

describe('formatLastSession', () => {
  // Runtime-constructed local epochs so the clock/day read under the active TZ.
  const at = (mo: number, d: number, h: number, mi: number): number =>
    new Date(2026, mo, d, h, mi, 0).getTime();

  it('formats a same-day session as "… today"', () => {
    const now = at(4, 26, 18, 0);
    expect(formatLastSession(at(4, 26, 16, 47), now)).toBe('4:47 PM today');
  });

  it('formats a previous-calendar-day session as "… yesterday"', () => {
    const now = at(4, 26, 9, 0);
    expect(formatLastSession(at(4, 25, 16, 47), now)).toBe('4:47 PM yesterday');
  });

  it('formats an older session with the weekday', () => {
    const now = at(4, 26, 9, 0); // Tue
    // 2026-05-23 is a Saturday.
    expect(formatLastSession(at(4, 23, 8, 5), now)).toBe('Sat 8:05 AM');
  });

  it('renders midnight as 12:00 AM and noon as 12:00 PM', () => {
    const now = at(4, 26, 23, 0);
    expect(formatLastSession(at(4, 26, 0, 0), now)).toBe('12:00 AM today');
    expect(formatLastSession(at(4, 26, 12, 0), now)).toBe('12:00 PM today');
  });
});
