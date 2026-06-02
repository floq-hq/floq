// The cross-tree PAIRING grant: an accepter may create the COUNTERPART's partner
// pointer, gated on a valid pending invite FROM that counterpart.
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import {
  setupEnv, teardownEnv, clear, authed, seed,
  seedInvite, seedPointer, assertSucceeds, assertFails,
} from './_setup';

const A = 'alice', B = 'bob', C = 'carol';
const CODE = 'ABCDEF';
const PAIR_AB = 'alice_bob';

// the doc lives in B's tree (ownerUid = B); the accepter is A.
function pointerInBsTree(overrides: Record<string, unknown> = {}) {
  return {
    pair_id: PAIR_AB,
    partner_uid: A,
    since: serverTimestamp(),
    invite_code: CODE,
    ...overrides,
  };
}

beforeAll(setupEnv);
afterAll(teardownEnv);
beforeEach(clear);

describe('cross-tree pairing grant — users/{owner}/partner/current', () => {
  it('X1: a valid invite from B lets A create B\'s pointer naming A', async () => {
    await seed((db) => seedInvite(db, CODE, B));
    await assertSucceeds(
      setDoc(doc(authed(A), 'users', B, 'partner', 'current'), pointerInBsTree()),
    );
  });

  it('X2: denied when partner_uid does not name the writer (forging another pairing)', async () => {
    await seed((db) => seedInvite(db, CODE, B));
    await assertFails(
      // carol writes B's pointer but names alice as the partner
      setDoc(doc(authed(C), 'users', B, 'partner', 'current'), pointerInBsTree()),
    );
  });

  it('X3: denied with no invite', async () => {
    await assertFails(
      setDoc(doc(authed(A), 'users', B, 'partner', 'current'), pointerInBsTree()),
    );
  });

  it('X4: denied on overwrite (pointer already exists → not a create)', async () => {
    await seed(async (db) => {
      await seedInvite(db, CODE, B);
      await seedPointer(db, B, C); // B already paired
    });
    await assertFails(
      setDoc(doc(authed(A), 'users', B, 'partner', 'current'), pointerInBsTree()),
    );
  });

  it('X5: denied when pair_id != sorted(writer, owner)', async () => {
    await seed((db) => seedInvite(db, CODE, B));
    await assertFails(
      setDoc(doc(authed(A), 'users', B, 'partner', 'current'), pointerInBsTree({ pair_id: 'wrong_id' })),
    );
  });

  it('X6: denied when the invite is from someone other than the owner', async () => {
    await seed((db) => seedInvite(db, CODE, C)); // invite from carol, not bob
    await assertFails(
      setDoc(doc(authed(A), 'users', B, 'partner', 'current'), pointerInBsTree()),
    );
  });

  it('X7: denied when the invite is expired', async () => {
    await seed((db) => seedInvite(db, CODE, B, { expiresInH: -1 }));
    await assertFails(
      setDoc(doc(authed(A), 'users', B, 'partner', 'current'), pointerInBsTree()),
    );
  });

  it('X8: denied with extra keys (hasOnly violation)', async () => {
    await seed((db) => seedInvite(db, CODE, B));
    await assertFails(
      setDoc(doc(authed(A), 'users', B, 'partner', 'current'), pointerInBsTree({ extra: true })),
    );
  });

  it('X9: the accepter may write their OWN pointer (recursive owner grant)', async () => {
    await seed((db) => seedInvite(db, CODE, B));
    await assertSucceeds(
      setDoc(doc(authed(A), 'users', A, 'partner', 'current'), {
        pair_id: PAIR_AB, partner_uid: B, since: serverTimestamp(), invite_code: CODE,
      }),
    );
  });
});
