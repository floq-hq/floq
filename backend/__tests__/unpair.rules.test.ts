// L30 — ending a partnership: a member flips active→ended, and tears down the
// counterpart pointer that names THEM (the cross-tree unpair grant).
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { doc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import {
  setupEnv, teardownEnv, clear, authed, seed,
  seedPartnership, seedPointer, assertSucceeds, assertFails,
} from './_setup';

const A = 'alice', B = 'bob', C = 'carol';
const PAIR_AB = 'alice_bob';

beforeAll(setupEnv);
afterAll(teardownEnv);
beforeEach(clear);

describe('L30 — partnership end transition (members-only)', () => {
  it('L1: a member flips active → ended', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active' }));
    await assertSucceeds(
      updateDoc(doc(authed(A), 'partnerships', PAIR_AB), { status: 'ended', ended_at: serverTimestamp() }),
    );
  });

  it('L2: a non-member cannot end it', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active' }));
    await assertFails(
      updateDoc(doc(authed(C), 'partnerships', PAIR_AB), { status: 'ended', ended_at: serverTimestamp() }),
    );
  });

  it('L3: members are immutable', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active' }));
    await assertFails(
      updateDoc(doc(authed(A), 'partnerships', PAIR_AB), { members: [A, C] }),
    );
  });

  it('L4: ended is terminal — no un-end', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'ended' }));
    await assertFails(
      updateDoc(doc(authed(A), 'partnerships', PAIR_AB), { status: 'active' }),
    );
  });

  it('L5: blocked_by must be self', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active' }));
    await assertFails(
      updateDoc(doc(authed(A), 'partnerships', PAIR_AB), {
        status: 'ended', blocked_by: B, ended_at: serverTimestamp(),
      }),
    );
    await seed((db) => seedPartnership(db, A, B, { status: 'active' }));
    await assertSucceeds(
      updateDoc(doc(authed(A), 'partnerships', PAIR_AB), {
        status: 'ended', blocked_by: A, ended_at: serverTimestamp(),
      }),
    );
  });

  it('L6: a member deletes the counterpart pointer that names them', async () => {
    await seed((db) => seedPointer(db, B, A)); // B's pointer names A as partner
    await assertSucceeds(deleteDoc(doc(authed(A), 'users', B, 'partner', 'current')));
  });

  it('L7: cannot delete a counterpart pointer that does not name you', async () => {
    await seed((db) => seedPointer(db, B, C)); // B's pointer names carol, not alice
    await assertFails(deleteDoc(doc(authed(A), 'users', B, 'partner', 'current')));
  });

  it('L8: the owner deletes their OWN pointer (recursive owner grant)', async () => {
    await seed((db) => seedPointer(db, A, B));
    await assertSucceeds(deleteDoc(doc(authed(A), 'users', A, 'partner', 'current')));
  });

  it('P3: a member may update only pair_streak_days (status frozen)', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active' }));
    await assertSucceeds(
      updateDoc(doc(authed(A), 'partnerships', PAIR_AB), { pair_streak_days: 3 }),
    );
  });
});
