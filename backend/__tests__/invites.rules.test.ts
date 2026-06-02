// partner_invites — create (issuer), get-by-code (any signed-in), no enumeration,
// and the two update transitions (issuer revoke / accepter accept).
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, getDocs, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import {
  setupEnv, teardownEnv, clear, authed, unauthed, seed,
  seedInvite, assertSucceeds, assertFails,
} from './_setup';

const A = 'alice', B = 'bob', C = 'carol';
const CODE = 'ABCDEF';
const HOUR = 60 * 60 * 1000;

function createPayload(from: string, overrides: Record<string, unknown> = {}) {
  return {
    code: CODE,
    from_uid: from,
    status: 'pending',
    created_at: serverTimestamp(),
    expires_at: Timestamp.fromMillis(Date.now() + 24 * HOUR),
    ...overrides,
  };
}

beforeAll(setupEnv);
afterAll(teardownEnv);
beforeEach(clear);

describe('partner_invites rules', () => {
  it('I1: the issuer creates a pending invite (code == id)', async () => {
    await assertSucceeds(setDoc(doc(authed(B), 'partner_invites', CODE), createPayload(B)));
  });

  it('I2: create denied when from_uid != self', async () => {
    await assertFails(setDoc(doc(authed(B), 'partner_invites', CODE), createPayload(A)));
  });

  it('I3: create denied when code != doc id', async () => {
    await assertFails(
      setDoc(doc(authed(B), 'partner_invites', CODE), createPayload(B, { code: 'ZZZZZZ' })),
    );
  });

  it('I4: create denied when expires_at is beyond ~72h', async () => {
    await assertFails(
      setDoc(doc(authed(B), 'partner_invites', CODE),
        createPayload(B, { expires_at: Timestamp.fromMillis(Date.now() + 80 * HOUR) })),
    );
  });

  it('I5: create denied with extra keys', async () => {
    await assertFails(
      setDoc(doc(authed(B), 'partner_invites', CODE), createPayload(B, { spam: true })),
    );
  });

  it('I6: any signed-in user can get an invite by code', async () => {
    await seed((db) => seedInvite(db, CODE, B));
    await assertSucceeds(getDoc(doc(authed(C), 'partner_invites', CODE)));
  });

  it('I7: an unauthenticated user cannot get an invite', async () => {
    await seed((db) => seedInvite(db, CODE, B));
    await assertFails(getDoc(doc(unauthed(), 'partner_invites', CODE)));
  });

  it('I8: listing/enumerating invites is denied', async () => {
    await seed((db) => seedInvite(db, CODE, B));
    await assertFails(getDocs(collection(authed(C), 'partner_invites')));
  });

  it('I9: the issuer revokes a pending invite', async () => {
    await seed((db) => seedInvite(db, CODE, B));
    await assertSucceeds(updateDoc(doc(authed(B), 'partner_invites', CODE), { status: 'revoked' }));
  });

  it('I10: a non-issuer cannot revoke', async () => {
    await seed((db) => seedInvite(db, CODE, B));
    await assertFails(updateDoc(doc(authed(C), 'partner_invites', CODE), { status: 'revoked' }));
  });

  it('I11: revoking an already-accepted invite is denied', async () => {
    await seed((db) => seedInvite(db, CODE, B, { status: 'accepted' }));
    await assertFails(updateDoc(doc(authed(B), 'partner_invites', CODE), { status: 'revoked' }));
  });

  it('I12: the accepter marks it accepted, stamping self', async () => {
    await seed((db) => seedInvite(db, CODE, B));
    await assertSucceeds(
      updateDoc(doc(authed(A), 'partner_invites', CODE), { status: 'accepted', accepted_by: A }),
    );
  });

  it('I13: accept denied when accepted_by spoofs another uid', async () => {
    await seed((db) => seedInvite(db, CODE, B));
    await assertFails(
      updateDoc(doc(authed(A), 'partner_invites', CODE), { status: 'accepted', accepted_by: C }),
    );
  });

  it('I14: accepting an expired invite is denied', async () => {
    await seed((db) => seedInvite(db, CODE, B, { expiresInH: -1 }));
    await assertFails(
      updateDoc(doc(authed(A), 'partner_invites', CODE), { status: 'accepted', accepted_by: A }),
    );
  });

  it('I15: mutating an immutable field (from_uid) is denied', async () => {
    await seed((db) => seedInvite(db, CODE, B));
    await assertFails(updateDoc(doc(authed(B), 'partner_invites', CODE), { from_uid: C }));
  });

  it('I16: hard-deleting an invite is denied', async () => {
    await seed((db) => seedInvite(db, CODE, B));
    await assertFails(deleteDoc(doc(authed(B), 'partner_invites', CODE)));
  });
});
