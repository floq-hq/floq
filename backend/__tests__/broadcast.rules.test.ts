// M7.4 — the broadcast-card claim probe. Capped MULTI-CLAIM codes + per-claim edge
// records. Additive collections; NO read grant in W7 (the edge is a record). Proves:
// issuer-only mint, claim edge-create gating, the per-code CAP + TTL enforced at
// claim-time, issuer bulk-revoke, and the per-edge read/list grants.
import { beforeAll, afterAll, beforeEach, describe, it } from 'vitest';
import {
  doc, getDoc, setDoc, updateDoc, serverTimestamp, Timestamp,
  collection, query, where, getDocs, writeBatch,
} from 'firebase/firestore';
import {
  setupEnv, teardownEnv, clear, authed, seed,
  seedBroadcastCode, seedBroadcastEdge, assertSucceeds, assertFails,
} from './_setup';

const I = 'alice', B = 'bob', C = 'carol'; // I = issuer, B = claimer, C = third party
const CODE = 'ABCDEF';
const EDGE = `${I}_${B}`;

/** A valid issuer-minted code body (created_at == request.time, ≤24h TTL, count 0). */
function codeBody(overrides: Record<string, unknown> = {}) {
  return {
    code: CODE,
    from_uid: I,
    status: 'active',
    created_at: serverTimestamp(),
    expires_at: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
    claim_count: 0,
    ...overrides,
  };
}

/** A valid claimer-created edge body. */
function edgeBody(overrides: Record<string, unknown> = {}) {
  return {
    from_uid: I,
    claimer_uid: B,
    code: CODE,
    status: 'active',
    created_at: serverTimestamp(),
    claimed_via_broadcast: true,
    ...overrides,
  };
}

beforeAll(setupEnv);
afterAll(teardownEnv);
beforeEach(clear);

describe('broadcast_codes — mint + transitions', () => {
  it('M1: the issuer mints a valid code', async () => {
    await assertSucceeds(setDoc(doc(authed(I), 'broadcast_codes', CODE), codeBody()));
  });

  it('M2: cannot mint a code naming someone else as from_uid', async () => {
    await assertFails(setDoc(doc(authed(C), 'broadcast_codes', CODE), codeBody()));
  });

  it('M3: claim_count must start at 0', async () => {
    await assertFails(setDoc(doc(authed(I), 'broadcast_codes', CODE), codeBody({ claim_count: 1 })));
  });

  it('M4: TTL over the 25h ceiling is denied', async () => {
    await assertFails(
      setDoc(doc(authed(I), 'broadcast_codes', CODE),
        codeBody({ expires_at: Timestamp.fromMillis(Date.now() + 30 * 60 * 60 * 1000) })),
    );
  });

  it('M5: extra keys denied (hasOnly)', async () => {
    await assertFails(setDoc(doc(authed(I), 'broadcast_codes', CODE), codeBody({ extra: true })));
  });

  it('M6: a signed-in user can get a code by id; list is denied', async () => {
    await seed((db) => seedBroadcastCode(db, CODE, I));
    await assertSucceeds(getDoc(doc(authed(C), 'broadcast_codes', CODE)));
    await assertFails(getDocs(query(collection(authed(C), 'broadcast_codes'))));
  });

  it('M7: the issuer revokes (active → revoked); a non-issuer cannot', async () => {
    await seed((db) => seedBroadcastCode(db, CODE, I, { claimCount: 2 }));
    await assertFails(updateDoc(doc(authed(C), 'broadcast_codes', CODE), { status: 'revoked' }));
    await assertSucceeds(updateDoc(doc(authed(I), 'broadcast_codes', CODE), { status: 'revoked' }));
  });
});

describe('broadcast_edges — claim gating', () => {
  it('E1: a claimer creates an edge against a live under-cap code', async () => {
    await seed((db) => seedBroadcastCode(db, CODE, I));
    await assertSucceeds(setDoc(doc(authed(B), 'broadcast_edges', EDGE), edgeBody()));
  });

  it('E2: self-claim (from_uid == me) is denied', async () => {
    await seed((db) => seedBroadcastCode(db, CODE, I));
    await assertFails(
      setDoc(doc(authed(I), 'broadcast_edges', `${I}_${I}`), edgeBody({ claimer_uid: I })),
    );
  });

  it('E3: the writer must be the claimer_uid', async () => {
    await seed((db) => seedBroadcastCode(db, CODE, I));
    // carol writes an edge claiming bob is the claimer
    await assertFails(setDoc(doc(authed(C), 'broadcast_edges', EDGE), edgeBody()));
  });

  it('E4: edgeId must be `${from}_${claimer}`', async () => {
    await seed((db) => seedBroadcastCode(db, CODE, I));
    await assertFails(setDoc(doc(authed(B), 'broadcast_edges', `${B}_${I}`), edgeBody()));
  });

  it('E5: claimed_via_broadcast must be true', async () => {
    await seed((db) => seedBroadcastCode(db, CODE, I));
    await assertFails(
      setDoc(doc(authed(B), 'broadcast_edges', EDGE), edgeBody({ claimed_via_broadcast: false })),
    );
  });

  it('E6: a revoked code denies the claim', async () => {
    await seed((db) => seedBroadcastCode(db, CODE, I, { status: 'revoked' }));
    await assertFails(setDoc(doc(authed(B), 'broadcast_edges', EDGE), edgeBody()));
  });

  it('E7: an expired code denies the claim', async () => {
    await seed((db) => seedBroadcastCode(db, CODE, I, { expiresInH: -1 }));
    await assertFails(setDoc(doc(authed(B), 'broadcast_edges', EDGE), edgeBody()));
  });

  it('E8: at the cap (claim_count == 5), a new edge is denied', async () => {
    await seed((db) => seedBroadcastCode(db, CODE, I, { claimCount: 5 }));
    await assertFails(setDoc(doc(authed(B), 'broadcast_edges', EDGE), edgeBody()));
  });

  it('E9: a double-claim (edge already exists) is denied (create-only)', async () => {
    await seed(async (db) => {
      await seedBroadcastCode(db, CODE, I, { claimCount: 1 });
      await seedBroadcastEdge(db, I, B, CODE);
    });
    await assertFails(setDoc(doc(authed(B), 'broadcast_edges', EDGE), edgeBody()));
  });
});

describe('broadcast_codes — the counter (cap anchor)', () => {
  it('K1: a claimer bumps claim_count by exactly 1 under the cap', async () => {
    await seed((db) => seedBroadcastCode(db, CODE, I, { claimCount: 2 }));
    await assertSucceeds(updateDoc(doc(authed(B), 'broadcast_codes', CODE), { claim_count: 3 }));
  });

  it('K2: a +2 jump is denied', async () => {
    await seed((db) => seedBroadcastCode(db, CODE, I, { claimCount: 2 }));
    await assertFails(updateDoc(doc(authed(B), 'broadcast_codes', CODE), { claim_count: 4 }));
  });

  it('K3: bumping from the cap (5 → 6) is denied', async () => {
    await seed((db) => seedBroadcastCode(db, CODE, I, { claimCount: 5 }));
    await assertFails(updateDoc(doc(authed(B), 'broadcast_codes', CODE), { claim_count: 6 }));
  });

  it('K4: the issuer cannot bump the counter (claim branch is non-issuer only)', async () => {
    await seed((db) => seedBroadcastCode(db, CODE, I, { claimCount: 1 }));
    await assertFails(updateDoc(doc(authed(I), 'broadcast_codes', CODE), { claim_count: 2 }));
  });

  it('K5: a claim on an expired code denies the counter bump too', async () => {
    await seed((db) => seedBroadcastCode(db, CODE, I, { claimCount: 1, expiresInH: -1 }));
    await assertFails(updateDoc(doc(authed(B), 'broadcast_codes', CODE), { claim_count: 2 }));
  });

  it('K6: the honest atomic claim (edge create + counter +1) succeeds in one batch', async () => {
    await seed((db) => seedBroadcastCode(db, CODE, I, { claimCount: 3 }));
    const dbB = authed(B); // one handle — refs must come from the same Firestore instance
    const b = writeBatch(dbB);
    b.set(doc(dbB, 'broadcast_edges', EDGE), edgeBody());
    b.update(doc(dbB, 'broadcast_codes', CODE), { claim_count: 4 });
    await assertSucceeds(b.commit());
  });

  it('K7: the honest atomic 6th claim (cap reached) fails the whole batch', async () => {
    await seed((db) => seedBroadcastCode(db, CODE, I, { claimCount: 5 }));
    const dbB = authed(B);
    const b = writeBatch(dbB);
    b.set(doc(dbB, 'broadcast_edges', EDGE), edgeBody());
    b.update(doc(dbB, 'broadcast_codes', CODE), { claim_count: 6 });
    await assertFails(b.commit());
  });
});

describe('broadcast_edges — reads + end (bulk-revoke)', () => {
  it('R1: the issuer and the claimer each read their own edge; a third party cannot', async () => {
    await seed((db) => seedBroadcastEdge(db, I, B, CODE));
    await assertSucceeds(getDoc(doc(authed(I), 'broadcast_edges', EDGE)));
    await assertSucceeds(getDoc(doc(authed(B), 'broadcast_edges', EDGE)));
    await assertFails(getDoc(doc(authed(C), 'broadcast_edges', EDGE)));
  });

  it('R2: the issuer lists their own edges (from_uid == me); a claimer cannot list', async () => {
    await seed((db) => seedBroadcastEdge(db, I, B, CODE));
    await assertSucceeds(
      getDocs(query(collection(authed(I), 'broadcast_edges'), where('from_uid', '==', I))),
    );
    await assertFails(
      getDocs(query(collection(authed(B), 'broadcast_edges'), where('from_uid', '==', I))),
    );
  });

  it('R3: the issuer ends an edge (active → ended); a third party cannot', async () => {
    await seed((db) => seedBroadcastEdge(db, I, B, CODE));
    await assertFails(updateDoc(doc(authed(C), 'broadcast_edges', EDGE), { status: 'ended' }));
    await assertSucceeds(updateDoc(doc(authed(I), 'broadcast_edges', EDGE), { status: 'ended' }));
  });

  it('R4: the claimer can also end their own edge (leave)', async () => {
    await seed((db) => seedBroadcastEdge(db, I, B, CODE));
    await assertSucceeds(updateDoc(doc(authed(B), 'broadcast_edges', EDGE), { status: 'ended' }));
  });

  it('R5: an edge cannot be hard-deleted', async () => {
    await seed((db) => seedBroadcastEdge(db, I, B, CODE));
    const { deleteDoc } = await import('firebase/firestore');
    await assertFails(deleteDoc(doc(authed(I), 'broadcast_edges', EDGE)));
  });
});
