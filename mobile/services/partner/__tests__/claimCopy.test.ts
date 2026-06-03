import { describe, expect, it } from 'vitest';
import { claimCopy, type AcceptOutcome } from '../claimCopy';
import type { AcceptReason } from '../../firebase';

const REASONS: (AcceptReason | 'offline' | 'failed')[] = [
  'code-not-found',
  'self-pair',
  'revoked',
  'expired',
  'already-paired',
  'inviter-already-paired',
  'ended',
  'not-signed-in',
  'bad-code',
  'offline',
  'failed',
];

describe('claimCopy', () => {
  it('paired (fresh) is a success with a non-retry action', () => {
    const c = claimCopy({ kind: 'paired', alreadyPaired: false });
    expect(c.tone).toBe('success');
    expect(c.action).toBe('dismiss');
    expect(c.title).toMatch(/paired/i);
  });

  it('paired (idempotent re-accept) reads as already-connected, neutral', () => {
    const c = claimCopy({ kind: 'paired', alreadyPaired: true });
    expect(c.tone).toBe('neutral');
    expect(c.action).toBe('dismiss');
  });

  it('every reason returns non-empty copy with a labelled action', () => {
    for (const reason of REASONS) {
      const c = claimCopy({ kind: 'error', reason } as AcceptOutcome);
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.body.length).toBeGreaterThan(0);
      expect(c.actionLabel.length).toBeGreaterThan(0);
      expect(['retry', 'edit', 'dismiss']).toContain(c.action);
    }
  });

  it('offline offers Retry (the code is persisted for the seam)', () => {
    const c = claimCopy({ kind: 'error', reason: 'offline' });
    expect(c.action).toBe('retry');
  });

  it('failed (a server rejection) does NOT claim the user is offline', () => {
    const c = claimCopy({ kind: 'error', reason: 'failed' });
    expect(c.action).toBe('retry');
    expect(c.tone).toBe('danger');
    expect(c.title.toLowerCase()).not.toContain('offline');
    expect(c.body.toLowerCase()).not.toContain('offline');
  });

  it('terminal states (already-paired, not-signed-in) do not invite a retry', () => {
    expect(claimCopy({ kind: 'error', reason: 'already-paired' }).action).toBe('dismiss');
    expect(claimCopy({ kind: 'error', reason: 'not-signed-in' }).action).toBe('dismiss');
  });

  it('correctable code mistakes route to edit', () => {
    for (const r of ['bad-code', 'code-not-found', 'expired', 'revoked'] as AcceptReason[]) {
      expect(claimCopy({ kind: 'error', reason: r }).action).toBe('edit');
    }
  });
});
