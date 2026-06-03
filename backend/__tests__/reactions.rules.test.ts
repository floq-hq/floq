// M7.2 reactions: users/{ownerUid}/reactions/{reactorUid} — cross-tree reactor
// write gated on partnerCanRead; owner+reactor read; ungated reactor delete.
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import {
  setupEnv, teardownEnv, clear, authed, seed,
  seedPartnership, seedReaction, assertSucceeds, assertFails,
} from './_setup';

const A = 'alice', B = 'bob', C = 'carol';

// A reaction A→B lives at users/B/reactions/A (owner B, reactor A).
function reaction(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'fire',
    reacted_at: serverTimestamp(), // rule asserts == request.time
    session_ended_at: Timestamp.fromMillis(Date.now()),
    ...overrides,
  };
}

beforeAll(setupEnv);
afterAll(teardownEnv);
beforeEach(clear);

describe('reactions rules', () => {
  it('R1: reactor creates a fire on a consented partner', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active', shareConsent: { [B]: true } }));
    await assertSucceeds(setDoc(doc(authed(A), 'users', B, 'reactions', A), reaction()));
  });

  it('R2: reactor creates a clap', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active', shareConsent: { [B]: true } }));
    await assertSucceeds(
      setDoc(doc(authed(A), 'users', B, 'reactions', A), reaction({ kind: 'clap' })),
    );
  });

  it('R3: owner reads received reactions', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'active', shareConsent: { [B]: true } });
      await seedReaction(db, B, A);
    });
    await assertSucceeds(getDoc(doc(authed(B), 'users', B, 'reactions', A)));
  });

  it('R4: reactor reads their own reaction', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'active', shareConsent: { [B]: true } });
      await seedReaction(db, B, A);
    });
    await assertSucceeds(getDoc(doc(authed(A), 'users', B, 'reactions', A)));
  });

  it('R5: a user CAN write their own reactions subtree (recursive owner grant) — self-react is a harmless client no-op, not a rule boundary; the security-meaningful gate is the cross-tree write (R6/R7/R17)', async () => {
    await assertSucceeds(setDoc(doc(authed(A), 'users', A, 'reactions', A), reaction()));
  });

  it('R6: non-partner denied', async () => {
    await seed((db) => seedReaction(db, B, C)); // no partnership
    await assertFails(setDoc(doc(authed(C), 'users', B, 'reactions', C), reaction()));
  });

  it('R7: un-consented partner denied', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active' })); // share_consent {}
    await assertFails(setDoc(doc(authed(A), 'users', B, 'reactions', A), reaction()));
  });

  it('R7b: legacy partnership (no share_consent) denies cleanly', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active', omitConsent: true }));
    await assertFails(setDoc(doc(authed(A), 'users', B, 'reactions', A), reaction()));
  });

  it('R8: ended partnership create denied', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'ended', shareConsent: { [B]: true } }));
    await assertFails(setDoc(doc(authed(A), 'users', B, 'reactions', A), reaction()));
  });

  it('R9: bad kind denied', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active', shareConsent: { [B]: true } }));
    await assertFails(
      setDoc(doc(authed(A), 'users', B, 'reactions', A), reaction({ kind: 'love' })),
    );
  });

  it('R10: extra key denied', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active', shareConsent: { [B]: true } }));
    await assertFails(
      setDoc(doc(authed(A), 'users', B, 'reactions', A), reaction({ note: 'hi' })),
    );
  });

  it('R11: missing kind denied (hasAll)', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active', shareConsent: { [B]: true } }));
    await assertFails(
      setDoc(doc(authed(A), 'users', B, 'reactions', A), {
        reacted_at: serverTimestamp(),
        session_ended_at: Timestamp.fromMillis(Date.now()),
      }),
    );
  });

  it('R12: client-clock reacted_at denied (must equal request.time)', async () => {
    await seed((db) => seedPartnership(db, A, B, { status: 'active', shareConsent: { [B]: true } }));
    await assertFails(
      setDoc(doc(authed(A), 'users', B, 'reactions', A), reaction({ reacted_at: Timestamp.now() })),
    );
  });

  it('R13: double-react is idempotent (update overwrites the same doc)', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'active', shareConsent: { [B]: true } });
      await seedReaction(db, B, A, { kind: 'fire' });
    });
    await assertSucceeds(
      setDoc(doc(authed(A), 'users', B, 'reactions', A), reaction({ kind: 'clap' })),
    );
  });

  it('R14: reactor delete is UNGATED even after the partnership ends', async () => {
    await seed(async (db) => {
      await seedPartnership(db, A, B, { status: 'ended' });
      await seedReaction(db, B, A);
    });
    await assertSucceeds(deleteDoc(doc(authed(A), 'users', B, 'reactions', A)));
  });

  it('R15: owner deletes a received reaction', async () => {
    await seed((db) => seedReaction(db, B, A));
    await assertSucceeds(deleteDoc(doc(authed(B), 'users', B, 'reactions', A)));
  });

  it('R16: a third party cannot delete a reaction', async () => {
    await seed((db) => seedReaction(db, B, A));
    await assertFails(deleteDoc(doc(authed(C), 'users', B, 'reactions', A)));
  });

  it('R17: cannot update someone else\'s reaction', async () => {
    await seed(async (db) => {
      await seedPartnership(db, B, C, { status: 'active', shareConsent: { [B]: true } });
      await seedReaction(db, B, C); // C's reaction on B
    });
    // A tries to overwrite C's reaction in B's tree
    await assertFails(setDoc(doc(authed(A), 'users', B, 'reactions', C), reaction()));
  });
});
