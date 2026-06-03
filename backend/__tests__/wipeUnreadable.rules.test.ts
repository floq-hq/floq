// M7.3 GATE (NEVER-CUT privacy floor) — a wiped user is UNREADABLE by their
// ex-partner across ALL surfaces, including the NAME.
//
// The wipe (wipeRemoteUserData) flips the co-owned partnership to `ended` and tears
// down both pointers; this suite proves that the resulting end-state denies the
// ex-partner every read in one cohesive matrix (per-surface ended-denials also live
// in partnerRead B3 / socialProfile SP3 / presence PR7 — this is the consolidated
// gate the acceptance asks for). A positive control proves the deny is the `ended`
// flip itself, not a broken fixture.
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  setupEnv, teardownEnv, clear, authed, seed,
  seedPartnership, seedPointer, seedPresence, seedSocial,
  assertSucceeds, assertFails,
} from './_setup';

const A = 'alice', B = 'bob'; // A = the ex-partner doing the reading; B = the wiped user

/** Seed the full set of B's docs an ex-partner might try to read. */
async function seedBsWorld(
  db: import('firebase/firestore').Firestore,
  partnershipStatus: 'active' | 'ended',
  shareConsent?: Record<string, boolean>,
) {
  await seedPartnership(db, A, B, { status: partnershipStatus, shareConsent });
  await seedSocial(db, B, 'summary', {
    minutes: 70, focus_score: 88, ended_at: Date.now(), phase_at_end: 'flow',
  });
  await seedSocial(db, B, 'profile', { display_name: 'Bob' }); // the NAME
  await seedPresence(db, B);
  await seedPointer(db, B, A); // B's pointer naming A
  await setDoc(doc(db, 'users', B, 'sessions', 's1'), { task: { title: 'secret' } });
  await setDoc(doc(db, 'users', B, 'tasks', 't1'), { title: 'secret' });
  await setDoc(doc(db, 'users', B), { display_name: 'Bob', data_cleared_at: 123 });
}

beforeAll(setupEnv);
afterAll(teardownEnv);
beforeEach(clear);

describe('M7.3 — wiped user unreadable by ex-partner', () => {
  it('W1: an ENDED partnership denies the ex-partner on EVERY surface, incl. the name', async () => {
    // The state a wipe leaves behind: partnership ended (consent is moot once ended).
    await seed((db) => seedBsWorld(db, 'ended', { [B]: true }));

    await assertFails(getDoc(doc(authed(A), 'users', B, 'social', 'summary')));
    await assertFails(getDoc(doc(authed(A), 'users', B, 'social', 'profile'))); // the NAME
    await assertFails(getDoc(doc(authed(A), 'presence', B)));
    await assertFails(getDoc(doc(authed(A), 'users', B, 'sessions', 's1')));
    await assertFails(getDoc(doc(authed(A), 'users', B, 'tasks', 't1')));
    await assertFails(getDoc(doc(authed(A), 'users', B))); // raw user doc
    await assertFails(getDoc(doc(authed(A), 'users', B, 'partner', 'current'))); // pointer
  });

  it('W2: positive control — while ACTIVE + consented, the projection reads SUCCEED', async () => {
    // Proves W1 is the `ended` flip doing the work, not an always-deny fixture.
    await seed((db) => seedBsWorld(db, 'active', { [B]: true }));

    await assertSucceeds(getDoc(doc(authed(A), 'users', B, 'social', 'summary')));
    await assertSucceeds(getDoc(doc(authed(A), 'users', B, 'social', 'profile')));
    await assertSucceeds(getDoc(doc(authed(A), 'presence', B)));
    // ...but L4 holds even when active: raw session/task/user stay denied.
    await assertFails(getDoc(doc(authed(A), 'users', B, 'sessions', 's1')));
    await assertFails(getDoc(doc(authed(A), 'users', B, 'tasks', 't1')));
    await assertFails(getDoc(doc(authed(A), 'users', B)));
  });
});
