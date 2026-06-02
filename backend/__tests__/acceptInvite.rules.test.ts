// RELEASE GATE A — the partnership-CREATE rule. A1 succeeding proves the rule's
// get()/exists() budget is UNDER the Spark 10-cap (over-cap denies every create).
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  setupEnv, teardownEnv, clear, authed, seed,
  seedInvite, seedPointer, assertSucceeds, assertFails,
} from './_setup';

const A = 'alice', B = 'bob', C = 'carol'; // sorted: alice < bob < carol
const CODE = 'ABCDEF';
const PAIR_AB = 'alice_bob';

function partnership(a: string, b: string, overrides: Record<string, unknown> = {}) {
  const [m0, m1] = a < b ? [a, b] : [b, a];
  return {
    members: [m0, m1],
    status: 'active',
    created_at: serverTimestamp(),
    pair_streak_days: 0,
    invite_code: CODE,
    ...overrides,
  };
}

beforeAll(setupEnv);
afterAll(teardownEnv);
beforeEach(clear);

describe('Gate A — partnership create', () => {
  it('A1: accept succeeds when invite is valid and neither party is paired (proves under-cap)', async () => {
    await seed((db) => seedInvite(db, CODE, B));
    await assertSucceeds(setDoc(doc(authed(A), 'partnerships', PAIR_AB), partnership(A, B)));
  });

  it('A2: rejected when MY pointer already exists', async () => {
    await seed(async (db) => {
      await seedInvite(db, CODE, B);
      await seedPointer(db, A, C);
    });
    await assertFails(setDoc(doc(authed(A), 'partnerships', PAIR_AB), partnership(A, B)));
  });

  it("A3: rejected when the INVITER's pointer already exists", async () => {
    await seed(async (db) => {
      await seedInvite(db, CODE, B);
      await seedPointer(db, B, C);
    });
    await assertFails(setDoc(doc(authed(A), 'partnerships', PAIR_AB), partnership(A, B)));
  });

  it('A4: rejected when the invite is expired', async () => {
    await seed((db) => seedInvite(db, CODE, B, { expiresInH: -1 }));
    await assertFails(setDoc(doc(authed(A), 'partnerships', PAIR_AB), partnership(A, B)));
  });

  it('A5: rejected when the invite is revoked', async () => {
    await seed((db) => seedInvite(db, CODE, B, { status: 'revoked' }));
    await assertFails(setDoc(doc(authed(A), 'partnerships', PAIR_AB), partnership(A, B)));
  });

  it('A6: rejected on self-pair (members must be two distinct sorted UIDs)', async () => {
    await seed((db) => seedInvite(db, CODE, A));
    await assertFails(
      setDoc(doc(authed(A), 'partnerships', 'alice_alice'), partnership(A, A)),
    );
  });

  it('A7: rejected when members are unsorted / pairId mismatches', async () => {
    await seed((db) => seedInvite(db, CODE, B));
    // doc id is the sorted pair but members written in the wrong order
    await assertFails(
      setDoc(doc(authed(A), 'partnerships', PAIR_AB), partnership(A, B, { members: [B, A] })),
    );
  });

  it('A9: rejected when no invite exists for the carried code', async () => {
    await assertFails(setDoc(doc(authed(A), 'partnerships', PAIR_AB), partnership(A, B)));
  });

  it('A10: rejected when the creator is not a member', async () => {
    await seed((db) => seedInvite(db, CODE, B));
    await assertFails(setDoc(doc(authed(C), 'partnerships', PAIR_AB), partnership(A, B)));
  });

  it('A11: rejected when invite.from_uid is not the other member', async () => {
    // invite is from carol, but the pair is alice+bob → from_uid != otherMember
    await seed((db) => seedInvite(db, CODE, C));
    await assertFails(setDoc(doc(authed(A), 'partnerships', PAIR_AB), partnership(A, B)));
  });
});
