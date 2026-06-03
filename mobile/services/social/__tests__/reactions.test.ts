import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  auth: { currentUser: { uid: 'me' } as { uid: string } | null },
  setDoc: vi.fn((..._a: unknown[]) => Promise.resolve()),
  deleteDoc: vi.fn((..._a: unknown[]) => Promise.resolve()),
  logEvent: vi.fn(),
  onSnapshotNext: null as null | ((snap: unknown) => void),
}));

vi.mock('../../firebase/init', () => ({ db: {} }));
vi.mock('../../firebase', () => ({
  auth: h.auth,
  useCurrentUser: () => ({ user: h.auth.currentUser, initializing: false }),
}));
vi.mock('../../analytics/logEvent', () => ({ logEvent: h.logEvent }));
vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  setDoc: (...a: unknown[]) => h.setDoc(...a),
  deleteDoc: (...a: unknown[]) => h.deleteDoc(...a),
  serverTimestamp: () => ({ __server: true }),
  Timestamp: { fromMillis: (ms: number) => ({ __ms: ms, toMillis: () => ms }) },
  onSnapshot: (_ref: unknown, next: (snap: unknown) => void) => {
    h.onSnapshotNext = next;
    return () => {};
  },
}));

import { sendReaction, removeReaction, subscribeReceivedReactions } from '../reactions';

beforeEach(() => {
  h.auth.currentUser = { uid: 'me' };
  h.setDoc.mockClear();
  h.deleteDoc.mockClear();
  h.logEvent.mockClear();
});

describe('reactions service', () => {
  it('RX1/RX2: sendReaction writes the partner-tree path with serverTimestamp reacted_at', async () => {
    await sendReaction('partner', 'fire', 1700000000000);
    const [ref, payload] = h.setDoc.mock.calls[0] as [
      { path: string },
      { kind: string; reacted_at: unknown; session_ended_at: unknown },
    ];
    expect(ref).toEqual({ path: 'users/partner/reactions/me' });
    expect(payload.kind).toBe('fire');
    expect(payload.reacted_at).toEqual({ __server: true }); // serverTimestamp, NOT Timestamp.now()
    expect(payload.session_ended_at).toMatchObject({ __ms: 1700000000000 });
  });

  it('RX3: sendReaction fires logEvent(reaction_sent, {kind})', async () => {
    await sendReaction('partner', 'clap', 1);
    expect(h.logEvent).toHaveBeenCalledWith('reaction_sent', { kind: 'clap' });
  });

  it('RX4: removeReaction deletes my reaction in the partner tree', async () => {
    await removeReaction('partner');
    expect(h.deleteDoc).toHaveBeenCalledTimes(1);
    expect(h.deleteDoc.mock.calls[0][0]).toEqual({ path: 'users/partner/reactions/me' });
  });

  it('RX5: signed-out sendReaction is a no-op', async () => {
    h.auth.currentUser = null;
    await sendReaction('partner', 'fire', 1);
    expect(h.setDoc).not.toHaveBeenCalled();
  });

  it('RX6: subscribeReceivedReactions maps snapshot docs → ReceivedReaction[]', () => {
    const received: unknown[] = [];
    subscribeReceivedReactions('me', (r) => received.push(...r));
    h.onSnapshotNext?.({
      docs: [
        {
          id: 'reactorX',
          data: () => ({ kind: 'clap', reacted_at: { toMillis: () => 10 }, session_ended_at: { toMillis: () => 20 } }),
        },
      ],
    });
    expect(received).toEqual([{ reactorUid: 'reactorX', kind: 'clap', reactedAt: 10, sessionEndedAt: 20 }]);
  });
});
