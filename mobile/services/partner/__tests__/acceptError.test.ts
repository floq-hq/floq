import { describe, expect, it } from 'vitest';
import { isOfflineError } from '../acceptError';

describe('isOfflineError', () => {
  it('true for genuine connectivity codes', () => {
    expect(isOfflineError({ code: 'unavailable' })).toBe(true);
    expect(isOfflineError({ code: 'deadline-exceeded' })).toBe(true);
    expect(isOfflineError({ code: 'firestore/unavailable' })).toBe(true);
  });

  it('FALSE for a server rejection (permission-denied) — not offline', () => {
    expect(isOfflineError({ code: 'permission-denied' })).toBe(false);
    expect(isOfflineError({ code: 'firestore/permission-denied' })).toBe(false);
    expect(isOfflineError({ code: 'internal' })).toBe(false);
    expect(isOfflineError({ code: 'unauthenticated' })).toBe(false);
  });

  it('FALSE for an error with no Firestore code', () => {
    expect(isOfflineError(new Error('boom'))).toBe(false);
    expect(isOfflineError({})).toBe(false);
    expect(isOfflineError(null)).toBe(false);
    expect(isOfflineError(undefined)).toBe(false);
    expect(isOfflineError('string')).toBe(false);
  });
});
