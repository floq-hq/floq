// Broadcast-card claim supply (M7.4) — the one k>1 growth probe.
//
// The shareable session card (S6.0) carries a CLAIMABLE broadcast code. UNLIKE the
// single-use 1:1 partner_invites, a broadcast code is MULTI-CLAIM (so a group-chat
// share works — single-use would fail every claimer but one) but carries a HARD
// per-code outstanding-edge CAP + a short TTL, enforced at claim-time in the write
// rule, plus issuer bulk-revoke. Each claim lands a coarse-only edge RECORD tagged
// `claimed_via_broadcast`.
//
// W7 SCOPE (locked): the edge grants NO presence/summary/profile read — it is a
// RECORD that advances the cap + fires the `card_claim` funnel event (the W8 Axis-A
// metric is the claim RATE). The read grant is a W9 follow-on; the cap moves onto a
// read predicate then. So L4/L2 are untouched: no titles, no behavioral data.
//
// All correctness lives in the transaction + backend/firestore.rules (the two
// broadcast_* blocks). React-free; the share-card embed, claim UI, and issuer
// local-notification are S-lane wiring (handed off).

import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './init';
import { auth } from './auth';
import { INVITE_ALPHABET, INVITE_CODE_LENGTH, normalizeCode } from './partners';
import { logEvent } from '../analytics/logEvent';

/** Hard per-code outstanding-edge cap (the abuse ceiling). Tunable knob — must match
 *  the `< 5` literals in the broadcast_codes/broadcast_edges rules. NOT a frozen
 *  science constant. */
export const BROADCAST_CAP = 5;
/** Short TTL (vs the 1:1 invite's 72h — shorter to bound fan-out). Tunable knob; the
 *  rule allows up to 25h for clock skew. */
export const BROADCAST_TTL_MS = 24 * 60 * 60 * 1000;
const COLLISION_RETRIES = 5;

/** Stable reasons claimBroadcast can reject with — S-lane maps each to claim-state copy. */
export type ClaimReason =
  | 'code-not-found'
  | 'self-claim'
  | 'revoked'
  | 'expired'
  | 'cap-reached'
  | 'not-signed-in'
  | 'bad-code';

export class ClaimError extends Error {
  constructor(public readonly reason: ClaimReason) {
    super(`claimBroadcast failed: ${reason}`);
    this.name = 'ClaimError';
  }
}

/** Issuer-first, directional edge id — must match the broadcast_edges rule. */
export function broadcastEdgeId(fromUid: string, claimerUid: string): string {
  return `${fromUid}_${claimerUid}`;
}

function generateCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_ALPHABET[Math.floor(Math.random() * INVITE_ALPHABET.length)];
  }
  return code;
}

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new ClaimError('not-signed-in');
  return uid;
}

/**
 * Mint a broadcast code for the shareable card. Server-collision-checked (re-rolls
 * on the rare hit); lands `active` with `claim_count: 0` and an explicit ≤24h TTL.
 * Returns the code plus a best-effort `floq://claim` pre-fill link (the typed code
 * carries the claim 100% — a link can't open an uninstalled app on a cold install).
 */
export async function createBroadcastCode(): Promise<{ code: string; link: string }> {
  const uid = requireUid();

  for (let attempt = 0; attempt < COLLISION_RETRIES; attempt++) {
    const code = generateCode();
    const ref = doc(db, 'broadcast_codes', code);
    const snap = await getDoc(ref);
    if (snap.exists()) continue; // collision — re-roll

    await setDoc(ref, {
      code,
      from_uid: uid,
      status: 'active',
      created_at: serverTimestamp(),
      // A concrete client Timestamp (not serverTimestamp) so the rule can
      // range-compare expires_at at write time; 24h window tolerates clock skew.
      expires_at: Timestamp.fromMillis(Date.now() + BROADCAST_TTL_MS),
      claim_count: 0,
    });
    logEvent('broadcast_created'); // M7.4 funnel
    return { code, link: `floq://claim?code=${code}` };
  }
  throw new Error('[broadcast] createBroadcastCode: could not allocate a unique code');
}

/**
 * Claim a typed broadcast code → land a coarse-only edge record. A single
 * transaction reads the code (status / expiry / cap / issuer) + the would-be edge,
 * then atomically creates broadcast_edges/{from_uid}_{me} AND increments the code's
 * claim_count — the counter doc is the concurrency anchor that makes the per-code
 * cap hold under a simultaneous-claim race (the loser retries, re-reads the bumped
 * count, and the rule denies). Idempotent: a repeat claim by the same user is a
 * no-op success (the edge is create-only). All rejections surface as a typed
 * ClaimError(reason).
 */
export async function claimBroadcast(
  code: string,
): Promise<{ edgeId: string; alreadyClaimed: boolean }> {
  const me = requireUid();
  const norm = normalizeCode(code); // throws AcceptError('bad-code') on a malformed code

  const result = await runTransaction(db, async (tx) => {
    // --- reads (all reads precede all writes in a Firestore transaction) ---
    const codeRef = doc(db, 'broadcast_codes', norm);
    const codeSnap = await tx.get(codeRef);
    if (!codeSnap.exists()) throw new ClaimError('code-not-found');

    const c = codeSnap.data() as {
      from_uid: string;
      status: string;
      expires_at: Timestamp;
      claim_count: number;
    };

    if (c.from_uid === me) throw new ClaimError('self-claim');
    if (c.status === 'revoked') throw new ClaimError('revoked');
    if (c.expires_at.toMillis() <= Date.now()) throw new ClaimError('expired');

    const edgeId = broadcastEdgeId(c.from_uid, me);
    const edgeRef = doc(db, 'broadcast_edges', edgeId);
    if ((await tx.get(edgeRef)).exists()) {
      // Already claimed — a no-op success (don't double-bump the counter).
      return { edgeId, alreadyClaimed: true };
    }

    if (c.claim_count >= BROADCAST_CAP) throw new ClaimError('cap-reached');

    // --- writes ---
    tx.set(edgeRef, {
      from_uid: c.from_uid,
      claimer_uid: me,
      code: norm,
      status: 'active',
      created_at: serverTimestamp(),
      claimed_via_broadcast: true,
    });
    // The counter bump is the atomic counterpart the cap rule checks (+1, < CAP).
    tx.update(codeRef, { claim_count: c.claim_count + 1 });

    return { edgeId, alreadyClaimed: false };
  });

  logEvent('card_claim', { already_claimed: result.alreadyClaimed }, 'broadcast'); // M7.4 funnel
  return result;
}

/**
 * Issuer bulk-revoke (the App-Store-1.2 cleanup). Flips the code to `revoked` (blocks
 * new claims via the claim rule) then ends every outstanding edge on it. Edges are
 * found by the issuer-only `from_uid == me` list grant; the code filter is applied
 * client-side so no composite index is needed. No-op-safe on a code with no claims.
 */
export async function revokeBroadcastCode(code: string): Promise<void> {
  const me = requireUid();
  const norm = normalizeCode(code);

  await updateDoc(doc(db, 'broadcast_codes', norm), { status: 'revoked' });

  const snap = await getDocs(
    query(collection(db, 'broadcast_edges'), where('from_uid', '==', me)),
  );
  const batch = writeBatch(db);
  let pending = 0;
  for (const d of snap.docs) {
    const e = d.data() as { code?: string; status?: string };
    if (e.code === norm && e.status === 'active') {
      batch.update(d.ref, { status: 'ended' });
      pending++;
    }
  }
  if (pending > 0) await batch.commit();

  logEvent('broadcast_revoked', { edges_ended: pending }); // M7.4 funnel
}
