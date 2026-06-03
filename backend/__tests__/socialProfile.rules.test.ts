// M7.1 users/{uid}/social/profile: an active partner reads the NAME WITHOUT
// consent (the L28 split — identity is visible once paired; focus DATA isn't
// until consent). Writes stay owner-only.
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  setupEnv, teardownEnv, clear, authed, seed,
  seedPartnership, seedSocial, assertSucceeds, assertFails,
} from './_setup';

const A = 'alice', B = 'bob', C = 'carol';

beforeAll(setupEnv);
afterAll(teardownEnv);
beforeEach(clear);

describe('social/profile rules', () => {
  it('SP1: an active partner reads the profile WITHOUT consent (the L28 split)', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'active' }); // no consent
      await seedSocial(db, B, 'profile', { display_name: 'Bob' });
    });
    await assertSucceeds(getDoc(doc(authed(A), 'users', B, 'social', 'profile')));
  });

  it('SP2: a non-partner is denied', async () => {
    await seed((db) => seedSocial(db, B, 'profile', { display_name: 'Bob' }));
    await assertFails(getDoc(doc(authed(C), 'users', B, 'social', 'profile')));
  });

  it('SP3: an ended partnership is denied', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'ended' });
      await seedSocial(db, B, 'profile', { display_name: 'Bob' });
    });
    await assertFails(getDoc(doc(authed(A), 'users', B, 'social', 'profile')));
  });

  it('SP4: the owner reads their own profile', async () => {
    await seed((db) => seedSocial(db, B, 'profile', { display_name: 'Bob' }));
    await assertSucceeds(getDoc(doc(authed(B), 'users', B, 'social', 'profile')));
  });

  it('SP5: a partner cannot WRITE the owner profile (owner-only)', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active' }));
    await assertFails(
      setDoc(doc(authed(A), 'users', B, 'social', 'profile'), { display_name: 'hacked' }),
    );
  });
});
