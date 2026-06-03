import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  auth: { currentUser: { uid: 'u1' } as { uid: string } | null },
  setDoc: vi.fn((..._a: unknown[]) => Promise.resolve()),
  getDoc: vi.fn(),
  rows: [] as unknown[],
  take: vi.fn(),
  mark: vi.fn(),
}));

vi.mock('../../firebase/init', () => ({ db: {} }));
vi.mock('../../firebase/auth', () => ({ auth: h.auth }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  setDoc: (...a: unknown[]) => h.setDoc(...a),
  getDoc: (...a: unknown[]) => h.getDoc(...a),
}));
vi.mock('../../storage/analyticsOutbox', () => ({
  takeUnuploadedEvents: () => h.take(),
  markEventUploaded: (id: string) => h.mark(id),
}));

import { flushAnalyticsEvents, toAnalyticsEventDoc } from '../uploadAnalyticsEvents';

function row(overrides: Record<string, unknown> = {}) {
  return { eventId: 'u1:1', uid: 'u1', name: 'invite_created', ts: 1700000000000, seq: 1, kind: '', props: {}, ...overrides };
}

beforeEach(() => {
  h.auth.currentUser = { uid: 'u1' };
  h.setDoc.mockReset().mockResolvedValue(undefined);
  h.getDoc.mockReset();
  h.take.mockReset().mockReturnValue([]);
  h.mark.mockReset();
});

describe('flushAnalyticsEvents', () => {
  it('U1: writes one doc per row to analytics_events/{eventId} and marks uploaded', async () => {
    h.take.mockReturnValue([row()]);
    await flushAnalyticsEvents();
    expect(h.setDoc).toHaveBeenCalledTimes(1);
    const [ref, payload] = h.setDoc.mock.calls[0] as [{ path: string }, Record<string, unknown>];
    expect(ref).toEqual({ path: 'analytics_events/u1:1' });
    expect(payload).toEqual({ uid: 'u1', name: 'invite_created', ts: 1700000000000, seq: 1, kind: '', props: {} });
    expect(h.mark).toHaveBeenCalledWith('u1:1');
  });

  it('U2: no-op when signed out', async () => {
    h.auth.currentUser = null;
    h.take.mockReturnValue([row()]);
    await flushAnalyticsEvents();
    expect(h.setDoc).not.toHaveBeenCalled();
  });

  it('U3: skips rows whose uid != current user', async () => {
    h.take.mockReturnValue([row({ uid: 'other' })]);
    await flushAnalyticsEvents();
    expect(h.setDoc).not.toHaveBeenCalled();
    expect(h.mark).not.toHaveBeenCalled();
  });

  it('U4: a create-on-existing dup (denied + doc exists) → marks uploaded', async () => {
    h.take.mockReturnValue([row()]);
    h.setDoc.mockRejectedValue(new Error('permission-denied'));
    h.getDoc.mockResolvedValue({ exists: () => true });
    await flushAnalyticsEvents();
    expect(h.mark).toHaveBeenCalledWith('u1:1');
  });

  it('U5: a genuine reject (denied + doc absent) → does NOT mark uploaded', async () => {
    h.take.mockReturnValue([row()]);
    h.setDoc.mockRejectedValue(new Error('permission-denied'));
    h.getDoc.mockResolvedValue({ exists: () => false });
    await flushAnalyticsEvents();
    expect(h.mark).not.toHaveBeenCalled();
  });

  it('U6: toAnalyticsEventDoc keeps ts as a number (offline-truthful)', () => {
    const d = toAnalyticsEventDoc(row() as never);
    expect(typeof d.ts).toBe('number');
    expect('event_id' in d).toBe(false);
  });
});
