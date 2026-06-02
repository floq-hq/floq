// partnerships — member-only read + the constrained update surface.
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import {
  setupEnv, teardownEnv, clear, authed, seed,
  seedPartnership, assertSucceeds, assertFails,
} from './_setup';

const A = 'alice', B = 'bob', C = 'carol';
const PAIR_AB = 'alice_bob';

beforeAll(setupEnv);
afterAll(teardownEnv);
beforeEach(clear);

describe('partnerships read/update', () => {
  it('P1: a member reads the partnership', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active' }));
    await assertSucceeds(getDoc(doc(authed(A), 'partnerships', PAIR_AB)));
  });

  it('P2: a non-member read is denied', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active' }));
    await assertFails(getDoc(doc(authed(C), 'partnerships', PAIR_AB)));
  });

  it('P5: a non-member update is denied', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active' }));
    await assertFails(updateDoc(doc(authed(C), 'partnerships', PAIR_AB), { pair_streak_days: 9 }));
  });

  it('P6: invite_code is immutable', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active' }));
    await assertFails(updateDoc(doc(authed(A), 'partnerships', PAIR_AB), { invite_code: 'ZZZZZZ' }));
  });
});
