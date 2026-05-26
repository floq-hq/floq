import { describe, it, expect } from 'vitest';
import { formatBackgroundDuration, backgroundDistractionMessage } from '../backgroundNotice';

describe('formatBackgroundDuration', () => {
  it('formats sub-minute durations in seconds', () => {
    expect(formatBackgroundDuration(47_000)).toBe('47s');
    expect(formatBackgroundDuration(31_000)).toBe('31s');
  });

  it('rounds to the nearest second', () => {
    expect(formatBackgroundDuration(47_400)).toBe('47s');
    expect(formatBackgroundDuration(47_600)).toBe('48s');
  });

  it('formats whole minutes without trailing seconds', () => {
    expect(formatBackgroundDuration(60_000)).toBe('1m');
    expect(formatBackgroundDuration(120_000)).toBe('2m');
  });

  it('formats minutes + seconds', () => {
    expect(formatBackgroundDuration(65_000)).toBe('1m 5s');
    expect(formatBackgroundDuration(155_000)).toBe('2m 35s');
  });

  it('never returns a negative duration', () => {
    expect(formatBackgroundDuration(-1)).toBe('0s');
  });
});

describe('backgroundDistractionMessage', () => {
  it('matches the S3.4 spec copy', () => {
    expect(backgroundDistractionMessage(47_000)).toBe('Backgrounded for 47s — logged a distraction.');
  });
});
