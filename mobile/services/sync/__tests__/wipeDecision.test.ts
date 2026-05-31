import { describe, it, expect } from 'vitest';
import { decideWipeAction } from '../wipeDecision';

describe('decideWipeAction', () => {
  it('no-ops when the remote tombstone is older than what we applied', () => {
    expect(decideWipeAction({ remoteMs: 100, appliedMs: 200, selfInitiated: false })).toBe('noop');
  });

  it('no-ops when the remote tombstone equals what we applied (idempotent re-fire)', () => {
    expect(decideWipeAction({ remoteMs: 200, appliedMs: 200, selfInitiated: false })).toBe('noop');
  });

  it('no-ops when there has never been a wipe (both zero)', () => {
    expect(decideWipeAction({ remoteMs: 0, appliedMs: 0, selfInitiated: false })).toBe('noop');
  });

  it('wipes when a NEWER tombstone arrives from another device', () => {
    expect(decideWipeAction({ remoteMs: 300, appliedMs: 200, selfInitiated: false })).toBe('wipe');
  });

  it('wipes on the very first remote wipe (applied is zero)', () => {
    expect(decideWipeAction({ remoteMs: 1, appliedMs: 0, selfInitiated: false })).toBe('wipe');
  });

  it('only RECORDS (no local wipe) when this device initiated the wipe', () => {
    // Our own echo: the clear flow already wiped local — re-wiping would nuke
    // anything created right after the clear.
    expect(decideWipeAction({ remoteMs: 300, appliedMs: 200, selfInitiated: true })).toBe('record');
  });

  it('self-initiated guard does not override staleness (older still no-ops)', () => {
    expect(decideWipeAction({ remoteMs: 100, appliedMs: 200, selfInitiated: true })).toBe('noop');
  });
});
