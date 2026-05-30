import { describe, it, expect } from 'vitest';

import { initialsFromName } from '../avatarInitials';

describe('initialsFromName', () => {
  it('takes first + last initial for a multi-word name', () => {
    expect(initialsFromName('Mohamed Hiba')).toBe('MH');
  });

  it('skips middle names (first + last only)', () => {
    expect(initialsFromName('Ada Marie Lovelace')).toBe('AL');
  });

  it('uses the single initial for a one-word name', () => {
    expect(initialsFromName('Mustafa')).toBe('M');
  });

  it('upper-cases the initials', () => {
    expect(initialsFromName('ada lovelace')).toBe('AL');
  });

  it('collapses extra whitespace', () => {
    expect(initialsFromName('  Mohamed   Hiba  ')).toBe('MH');
  });

  it('falls back to "?" for empty / whitespace-only names', () => {
    expect(initialsFromName('')).toBe('?');
    expect(initialsFromName('   ')).toBe('?');
  });
});
