// M7.1 consent-self-toggle on partnerships/{pairId}: a member flips ONLY their
// own share_consent key; the other member's key and all immutables stay frozen.
// Includes the Gap-1 regression: the streak branch must NOT be a backdoor to flip
// the other member's consent.
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { doc, updateDoc } from 'firebase/firestore';
import {
  setupEnv, teardownEnv, clear, authed, seed,
  seedPartnership, assertSucceeds, assertFails,
} from './_setup';

const A = 'alice', B = 'bob', C = 'carol';
const PAIR_AB = 'alice_bob';

beforeAll(setupEnv);
afterAll(teardownEnv);
beforeEach(clear);

describe('consent-self-toggle', () => {
  it('C1: a member toggles their OWN key via dot-path', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active' }));
    await assertSucceeds(
      updateDoc(doc(authed(A), 'partnerships', PAIR_AB), { [`share_consent.${A}`]: true }),
    );
  });

  it('C2: a member cannot set the OTHER member\'s key', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active' }));
    await assertFails(
      updateDoc(doc(authed(A), 'partnerships', PAIR_AB), { [`share_consent.${B}`]: true }),
    );
  });

  it('C3 (Gap-1 regression): cannot flip the other member\'s bit via a full-map rewrite', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active', shareConsent: { [A]: true } }));
    // pair_streak_days unchanged → tries to ride the streak branch while flipping B.
    await assertFails(
      updateDoc(doc(authed(A), 'partnerships', PAIR_AB), { share_consent: { [A]: true, [B]: true } }),
    );
  });

  it('C4: cannot toggle consent AND bump the streak in one update', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active' }));
    await assertFails(
      updateDoc(doc(authed(A), 'partnerships', PAIR_AB), {
        [`share_consent.${A}`]: true,
        pair_streak_days: 5,
      }),
    );
  });

  it('C5: a non-member cannot toggle consent', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active' }));
    await assertFails(
      updateDoc(doc(authed(C), 'partnerships', PAIR_AB), { [`share_consent.${C}`]: true }),
    );
  });

  it('C-legacy: a member introduces their key on a legacy doc (no share_consent field)', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active', omitConsent: true }));
    await assertSucceeds(
      updateDoc(doc(authed(A), 'partnerships', PAIR_AB), { [`share_consent.${A}`]: true }),
    );
  });
});
