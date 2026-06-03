// INTEGRATION regression for the cross-device "offline" pairing bug: run the REAL
// (fixed) acceptInvite transaction as the ACCEPTER against the rules. The accepter
// may only read the invite + their OWN pointer; the inviter's pointer and the
// not-yet-existing partnership are NOT accepter-readable, so a tx.get on either is
// permission-denied and breaks pairing. This test does exactly the reads+writes
// partners.ts does, end to end, so the integration gap can't reopen.
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { doc, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import {
  setupEnv, teardownEnv, clear, authed, seed, seedInvite, seedPointer,
  assertSucceeds, assertFails,
} from './_setup';

const A = 'alice', B = 'bob'; // accepter A, inviter B
const CODE = 'ABCDEF';
const PAIR = 'alice_bob';

beforeAll(setupEnv);
afterAll(teardownEnv);
beforeEach(clear);

// Mirrors the fixed partners.ts acceptInvite transaction (reads the accepter is
// allowed: invite + own pointer; then the four writes).
function acceptTxn(db: ReturnType<typeof authed>) {
  return runTransaction(db, async (tx) => {
    await tx.get(doc(db, 'partner_invites', CODE)); // read: invite (signed-in get)
    await tx.get(doc(db, 'users', A, 'partner', 'current')); // read: OWN pointer
    tx.set(doc(db, 'partnerships', PAIR), {
      members: [A, B], status: 'active', created_at: serverTimestamp(),
      pair_streak_days: 0, invite_code: CODE, share_consent: {},
    });
    tx.set(doc(db, 'users', A, 'partner', 'current'), {
      pair_id: PAIR, partner_uid: B, since: serverTimestamp(), invite_code: CODE,
    });
    tx.set(doc(db, 'users', B, 'partner', 'current'), {
      pair_id: PAIR, partner_uid: A, since: serverTimestamp(), invite_code: CODE,
    });
    tx.update(doc(db, 'partner_invites', CODE), { status: 'accepted', accepted_by: A });
  });
}

describe('acceptInvite cross-device flow (regression)', () => {
  it('FRESH pair: the full accepter transaction commits (no forbidden reads)', async () => {
    await seed((db) => seedInvite(db, CODE, B));
    await assertSucceeds(acceptTxn(authed(A)));
  });

  it('inviter already paired: the transaction fails CLOSED at the write (create rule)', async () => {
    await seed(async (db) => {
      await seedInvite(db, CODE, B);
      await seedPointer(db, B, 'someoneElse'); // inviter's pointer already exists
    });
    await assertFails(acceptTxn(authed(A)));
  });

  it('accepter already paired: the transaction fails (their own pointer exists)', async () => {
    await seed(async (db) => {
      await seedInvite(db, CODE, B);
      await seedPointer(db, A, 'someoneElse'); // accepter's pointer already exists
    });
    await assertFails(acceptTxn(authed(A)));
  });
});
