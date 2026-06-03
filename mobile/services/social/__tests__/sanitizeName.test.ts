import { describe, it, expect } from 'vitest';
import { sanitizeDisplayNameForPartner, SAFE_FALLBACK } from '../sanitizeName';

describe('sanitizeDisplayNameForPartner', () => {
  it('passes a normal name through unchanged', () => {
    expect(sanitizeDisplayNameForPartner('Mohamed')).toBe('Mohamed');
    expect(sanitizeDisplayNameForPartner('Ada L.')).toBe('Ada L.');
  });

  it('trims and strips control characters', () => {
    expect(sanitizeDisplayNameForPartner('  Sara  ')).toBe('Sara');
  });

  it('caps length at 40', () => {
    const long = 'a'.repeat(60);
    expect(sanitizeDisplayNameForPartner(long)).toHaveLength(40);
  });

  it('downgrades a phone number to the fallback', () => {
    expect(sanitizeDisplayNameForPartner('555-123-4567')).toBe(SAFE_FALLBACK);
    expect(sanitizeDisplayNameForPartner('call +1 (415) 555 0123')).toBe(SAFE_FALLBACK);
  });

  it('downgrades a URL to the fallback', () => {
    expect(sanitizeDisplayNameForPartner('evil.com/x')).toBe(SAFE_FALLBACK);
    expect(sanitizeDisplayNameForPartner('https://x.io')).toBe(SAFE_FALLBACK);
    expect(sanitizeDisplayNameForPartner('www.spam.net')).toBe(SAFE_FALLBACK);
  });

  it('downgrades a slur (across separators) to the fallback', () => {
    expect(sanitizeDisplayNameForPartner('r e t a r d')).toBe(SAFE_FALLBACK);
  });

  it('empty / whitespace / non-string → fallback', () => {
    expect(sanitizeDisplayNameForPartner('')).toBe(SAFE_FALLBACK);
    expect(sanitizeDisplayNameForPartner('   ')).toBe(SAFE_FALLBACK);
    expect(sanitizeDisplayNameForPartner(null)).toBe(SAFE_FALLBACK);
    expect(sanitizeDisplayNameForPartner(42)).toBe(SAFE_FALLBACK);
  });

  it('a URL beyond char 40 is cut off by the cap (already neutralized)', () => {
    const name = 'a'.repeat(45) + ' evil.com';
    expect(sanitizeDisplayNameForPartner(name)).toHaveLength(40); // sliced before the URL
  });
});
