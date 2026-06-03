import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  mmkv: new Map<string, number>(),
  auth: { currentUser: { uid: 'u1' } as { uid: string } | null },
  enqueueEvent: vi.fn(),
  flushAnalyticsEvents: vi.fn(() => Promise.resolve()),
}));

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getNumber: (k: string) => h.mmkv.get(k),
    set: (k: string, v: number) => h.mmkv.set(k, v),
  }),
}));
vi.mock('../../firebase/auth', () => ({ auth: h.auth }));
vi.mock('../../storage/analyticsOutbox', () => ({ enqueueEvent: h.enqueueEvent }));
vi.mock('../uploadAnalyticsEvents', () => ({ flushAnalyticsEvents: h.flushAnalyticsEvents }));

import { logEvent, sanitizeProps } from '../logEvent';

beforeEach(() => {
  h.mmkv.clear();
  h.auth.currentUser = { uid: 'u1' };
  h.enqueueEvent.mockClear();
  h.flushAnalyticsEvents.mockClear();
});

describe('logEvent', () => {
  it('L1: enqueues a row with the deterministic eventId `${uid}:${seq}`', () => {
    logEvent('invite_created');
    expect(h.enqueueEvent).toHaveBeenCalledTimes(1);
    const e = h.enqueueEvent.mock.calls[0][0];
    expect(e).toMatchObject({ eventId: 'u1:1', uid: 'u1', name: 'invite_created', seq: 1 });
    expect(typeof e.ts).toBe('number');
    expect(h.flushAnalyticsEvents).toHaveBeenCalled();
  });

  it('L2: two calls increment seq and produce distinct eventIds', () => {
    logEvent('invite_created');
    logEvent('reaction_sent', { kind: 'fire' });
    expect(h.enqueueEvent.mock.calls[0][0].eventId).toBe('u1:1');
    expect(h.enqueueEvent.mock.calls[1][0].eventId).toBe('u1:2');
    expect(h.enqueueEvent.mock.calls[1][0].props).toEqual({ kind: 'fire' });
  });

  it('L3: seq persists monotonically across calls (MMKV counter)', () => {
    logEvent('skip');
    expect(h.mmkv.get('floq.analytics.seq')).toBe(1);
    logEvent('skip');
    expect(h.mmkv.get('floq.analytics.seq')).toBe(2);
  });

  it('L4: sanitizeProps keeps primitives, truncates strings, drops nested', () => {
    expect(sanitizeProps({ a: 1, b: true, c: 'x' })).toEqual({ a: 1, b: true, c: 'x' });
    expect(sanitizeProps({ s: 'x'.repeat(100) }).s).toHaveLength(64);
    // @ts-expect-error testing a runtime non-primitive
    expect(sanitizeProps({ obj: { nested: 1 }, arr: [1], ok: 2 })).toEqual({ ok: 2 });
  });

  it('L5: no-op when signed out (no anon rows)', () => {
    h.auth.currentUser = null;
    logEvent('install');
    expect(h.enqueueEvent).not.toHaveBeenCalled();
  });
});
