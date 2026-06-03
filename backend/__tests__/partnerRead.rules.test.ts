// RELEASE GATE B — the sorted-UID isPartner() partner-read predicate. An ACTIVE
// partner reads users/{owner}/social/summary; everyone else (and every other
// path) is DENIED. The summary WRITER is M7.1 — here we admin-seed a fake doc.
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  setupEnv, teardownEnv, clear, authed, seed,
  seedPartnership, assertSucceeds, assertFails,
} from './_setup';

const A = 'alice', B = 'bob', C = 'carol', D = 'dave';

async function seedSummary(db: import('firebase/firestore').Firestore, uid: string) {
  await setDoc(doc(db, 'users', uid, 'social', 'summary'), {
    minutes: 70, focus_score: 88, ended_at: Date.now(), phase_at_end: 'flow',
  });
}

beforeAll(setupEnv);
afterAll(teardownEnv);
beforeEach(clear);

describe('Gate B — partner read of social/summary', () => {
  it('B1: an active, CONSENTED partner reads the summary', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'active', shareConsent: { [B]: true } });
      await seedSummary(db, B);
    });
    await assertSucceeds(getDoc(doc(authed(A), 'users', B, 'social', 'summary')));
  });

  it('B1b: an active but UN-consented partner is denied (M7.1 consent gate)', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'active' }); // share_consent defaults {}
      await seedSummary(db, B);
    });
    await assertFails(getDoc(doc(authed(A), 'users', B, 'social', 'summary')));
  });

  it('B1c: a legacy partnership (no share_consent field) denies cleanly, not errors', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'active', omitConsent: true });
      await seedSummary(db, B);
    });
    await assertFails(getDoc(doc(authed(A), 'users', B, 'social', 'summary')));
  });

  it('B2: a non-partner is denied', async () => {
    await seed((db) => seedSummary(db, B));
    await assertFails(getDoc(doc(authed(C), 'users', B, 'social', 'summary')));
  });

  it('B3: an ended partnership is denied', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'ended' });
      await seedSummary(db, B);
    });
    await assertFails(getDoc(doc(authed(A), 'users', B, 'social', 'summary')));
  });

  it('B4: a blocked (ended + blocked_by) partnership is denied', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'ended', blockedBy: B });
      await seedSummary(db, B);
    });
    await assertFails(getDoc(doc(authed(A), 'users', B, 'social', 'summary')));
  });

  it('B5: a partner is DENIED on the raw sessions subcollection (L4 holds)', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'active' });
      await setDoc(doc(db, 'users', B, 'sessions', 's1'), { task: { title: 'secret' } });
    });
    await assertFails(getDoc(doc(authed(A), 'users', B, 'sessions', 's1')));
  });

  it('B6: a partner is DENIED on the tasks subcollection', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'active' });
      await setDoc(doc(db, 'users', B, 'tasks', 't1'), { title: 'secret' });
    });
    await assertFails(getDoc(doc(authed(A), 'users', B, 'tasks', 't1')));
  });

  it('B7: a partner is DENIED on the raw user doc', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'active' });
      await setDoc(doc(db, 'users', B), { display_name: 'Bob', email: 'bob@x.com' });
    });
    await assertFails(getDoc(doc(authed(A), 'users', B)));
  });

  it('B8: a partner is DENIED on the counterpart partner pointer', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'active' });
      await setDoc(doc(db, 'users', B, 'partner', 'current'), { pair_id: 'alice_bob', partner_uid: A });
    });
    await assertFails(getDoc(doc(authed(A), 'users', B, 'partner', 'current')));
  });

  it('B9: the owner still reads their own summary', async () => {
    await seed((db) => seedSummary(db, B));
    await assertSucceeds(getDoc(doc(authed(B), 'users', B, 'social', 'summary')));
  });

  it('B10: a reader paired with someone else cannot read this owner', async () => {
    await seed(async (db) => {
      await seedPartnership(db, C, D, { status: 'active' }); // A is paired with nobody / C-D unrelated
      await seedSummary(db, B);
    });
    await assertFails(getDoc(doc(authed(A), 'users', B, 'social', 'summary')));
  });
});
