// M7.1 presence/{uid}: owner write/delete; a CONSENTED active partner reads.
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import {
  setupEnv, teardownEnv, clear, authed, seed,
  seedPartnership, seedPresence, assertSucceeds, assertFails,
} from './_setup';

const A = 'alice', B = 'bob', C = 'carol';

beforeAll(setupEnv);
afterAll(teardownEnv);
beforeEach(clear);

describe('presence rules', () => {
  it('PR1: owner writes own presence', async () => {
    await assertSucceeds(
      setDoc(doc(authed(A), 'presence', A), { state: 'focusing', started_at: Date.now() }),
    );
  });

  it('PR2: owner deletes own presence', async () => {
    await seed((db) => seedPresence(db, A));
    await assertSucceeds(deleteDoc(doc(authed(A), 'presence', A)));
  });

  it('PR3: a non-owner cannot write presence', async () => {
    await assertFails(
      setDoc(doc(authed(C), 'presence', A), { state: 'focusing', started_at: Date.now() }),
    );
  });

  it('PR4: a consented active partner reads presence', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'active', shareConsent: { [A]: true } });
      await seedPresence(db, A);
    });
    await assertSucceeds(getDoc(doc(authed(B), 'presence', A)));
  });

  it('PR5: an un-consented partner is denied', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'active' });
      await seedPresence(db, A);
    });
    await assertFails(getDoc(doc(authed(B), 'presence', A)));
  });

  it('PR6: a non-partner is denied', async () => {
    await seed((db) => seedPresence(db, A));
    await assertFails(getDoc(doc(authed(C), 'presence', A)));
  });

  it('PR7: an ended partnership (even consented) is denied', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'ended', shareConsent: { [A]: true } });
      await seedPresence(db, A);
    });
    await assertFails(getDoc(doc(authed(B), 'presence', A)));
  });

  it('PR8: a STALE focusing doc still reads (staleness is a client concern, not a rule)', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'active', shareConsent: { [A]: true } });
      await seedPresence(db, A, { state: 'focusing', started_at: 1 }); // ancient
    });
    await assertSucceeds(getDoc(doc(authed(B), 'presence', A)));
  });
});
