// Partner edge + invite-code install-and-pair (M7.0).
//
// The 1:1 focus partnership (L18 Phase A). A user has at most ONE partner at a
// time, enforced by the singleton pointer doc users/{uid}/partner/current — its
// existence IS the "paired" state. Pairing is carried 100% by a typed 6-char
// code (a floq:// link can't open an uninstalled app, so it's pre-fill only).
//
// All of acceptInvite's correctness lives in a single Firestore transaction +
// the backend/firestore.rules predicates (release gates A & B). This module is
// the client half; the rules are the authority. No cloud function (Spark / L13).
//
// React-free. Screen wiring (the invite field, consent UI, claim-state copy) is
// S7.0 — this module only exposes the service + a typed error.

import {
  Timestamp,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './init';
import { auth } from './auth';
import { projectDisplayName } from '../social/profile';

/** 32 unambiguous symbols: 26 letters minus I/O (confusable with 1/0) + digits 2–9. */
export const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 6;
const INVITE_TTL_MS = 72 * 60 * 60 * 1000; // ≤72h (rules allow up to 73h for skew)
const COLLISION_RETRIES = 5;

/** Stable reasons acceptInvite can reject with — S7.0 maps each to claim-state copy. */
export type AcceptReason =
  | 'code-not-found'
  | 'self-pair'
  | 'revoked'
  | 'expired'
  | 'already-paired'
  | 'inviter-already-paired'
  | 'ended'
  | 'not-signed-in'
  | 'bad-code';

export class AcceptError extends Error {
  constructor(public readonly reason: AcceptReason) {
    super(`acceptInvite failed: ${reason}`);
    this.name = 'AcceptError';
  }
}

/** Sorted-UID pair id — must match the `pairIdOf` helper in firestore.rules. */
export function pairIdOf(a: string, b: string): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

/** Uppercase, strip separators, validate length + alphabet. Throws on a bad code. */
export function normalizeCode(raw: string): string {
  const code = raw.trim().toUpperCase().replace(/[\s-]+/g, '');
  if (code.length !== INVITE_CODE_LENGTH) throw new AcceptError('bad-code');
  for (const ch of code) {
    if (!INVITE_ALPHABET.includes(ch)) throw new AcceptError('bad-code');
  }
  return code;
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
  if (!uid) throw new AcceptError('not-signed-in');
  return uid;
}

/**
 * Mint a single-use invite. Server-collision-checked (re-rolls on the rare hit);
 * lands `pending` with an explicit ≤72h `expires_at`. Returns the code plus a
 * best-effort `floq://` pre-fill link — pairing itself is carried 100% by the
 * typed code (the link can't open an uninstalled app on a cold install).
 */
export async function createInvite(): Promise<{ code: string; link: string }> {
  const uid = requireUid();

  for (let attempt = 0; attempt < COLLISION_RETRIES; attempt++) {
    const code = generateCode();
    const ref = doc(db, 'partner_invites', code);
    const snap = await getDoc(ref);
    if (snap.exists()) continue; // collision — re-roll

    await setDoc(ref, {
      code,
      from_uid: uid,
      status: 'pending',
      created_at: serverTimestamp(),
      // A concrete client Timestamp (not serverTimestamp) so the rules can
      // range-compare expires_at at write time; 72h window tolerates clock skew.
      expires_at: Timestamp.fromMillis(Date.now() + INVITE_TTL_MS),
    });
    // M7.1: project my name now so it exists by the time someone accepts — powers
    // the inviter-side "{name} joined — hasn't focused yet" dormant state.
    void projectDisplayName(auth.currentUser?.displayName ?? '').catch(() => {});
    return { code, link: `floq://pair?code=${code}` };
  }
  throw new Error('[partners] createInvite: could not allocate a unique code');
}

/** Issuer revokes their own pending invite (rule update branch (i)). */
export async function revokeInvite(code: string): Promise<void> {
  const norm = normalizeCode(code);
  await updateDoc(doc(db, 'partner_invites', norm), { status: 'revoked' });
}

/**
 * Accept a typed code and land paired immediately. A single transaction reads
 * the invite + partnership + both pointers, then atomically creates the
 * partnership (`active`), both singleton pointers (the inviter's via the
 * cross-tree pairing grant), and flips the invite to `accepted`. Atomicity +
 * the rule's re-check of both pointers being absent is what enforces "one
 * partner at a time" under a simultaneous-accept race (Firestore retries the
 * transaction with fresh reads; the loser hits an already-paired rejection).
 *
 * Idempotent: re-accepting when the same active partnership already exists is a
 * no-op success. All rejections surface as a typed AcceptError(reason).
 */
export async function acceptInvite(
  code: string,
): Promise<{ pairId: string; alreadyPaired: boolean }> {
  const me = requireUid();
  const norm = normalizeCode(code); // throws AcceptError('bad-code') on a malformed code

  const result = await runTransaction(db, async (tx) => {
    // --- reads (all reads precede all writes in a Firestore transaction) ---
    const inviteRef = doc(db, 'partner_invites', norm);
    const inviteSnap = await tx.get(inviteRef);
    if (!inviteSnap.exists()) throw new AcceptError('code-not-found');

    const inv = inviteSnap.data() as {
      from_uid: string;
      status: string;
      expires_at: Timestamp;
    };
    const inviter = inv.from_uid;

    if (inviter === me) throw new AcceptError('self-pair');
    if (inv.status === 'revoked') throw new AcceptError('revoked');
    if (inv.status === 'expired') throw new AcceptError('expired');
    if (inv.expires_at.toMillis() <= Date.now()) throw new AcceptError('expired');

    const pairId = pairIdOf(me, inviter);
    const [m0, m1] = me < inviter ? [me, inviter] : [inviter, me];

    // Idempotency: same active partnership already exists -> no-op success.
    const pairRef = doc(db, 'partnerships', pairId);
    const pairSnap = await tx.get(pairRef);
    if (pairSnap.exists()) {
      const p = pairSnap.data() as { status: string; members: string[] };
      if (p.status === 'active' && p.members.includes(me) && p.members.includes(inviter)) {
        return { pairId, alreadyPaired: true };
      }
      if (p.status === 'ended') throw new AcceptError('ended'); // re-pair is S7.0
      throw new AcceptError('already-paired');
    }

    // Either party already paired -> reject (the singleton-pointer invariant).
    const myPtrRef = doc(db, 'users', me, 'partner', 'current');
    const theirPtrRef = doc(db, 'users', inviter, 'partner', 'current');
    if ((await tx.get(myPtrRef)).exists()) throw new AcceptError('already-paired');
    if ((await tx.get(theirPtrRef)).exists()) throw new AcceptError('inviter-already-paired');

    // --- writes ---
    tx.set(pairRef, {
      members: [m0, m1],
      status: 'active',
      created_at: serverTimestamp(),
      pair_streak_days: 0,
      invite_code: norm,
      share_consent: {}, // M7.1: per-member sharing, default-OFF (L28); toggled later
    });
    tx.set(myPtrRef, {
      pair_id: pairId,
      partner_uid: inviter,
      since: serverTimestamp(),
      invite_code: norm,
    });
    // The inviter's pointer is a cross-tree write, authorized by the pairing
    // grant in firestore.rules (gated on this committed pending invite).
    tx.set(theirPtrRef, {
      pair_id: pairId,
      partner_uid: me,
      since: serverTimestamp(),
      invite_code: norm,
    });
    tx.update(inviteRef, { status: 'accepted', accepted_by: me });

    return { pairId, alreadyPaired: false };
  });

  // M7.1: project my name after the pairing commits (self-write — NOT inside the
  // transaction, which can't reach social/profile cross-tree). Best-effort.
  void projectDisplayName(auth.currentUser?.displayName ?? '').catch(() => {});
  return result;
}

/** Read my current pointer, or null if I'm solo. */
async function readMyPointer(): Promise<{ pairId: string; partnerUid: string } | null> {
  const me = requireUid();
  const snap = await getDoc(doc(db, 'users', me, 'partner', 'current'));
  if (!snap.exists()) return null;
  const d = snap.data() as { pair_id: string; partner_uid: string };
  return { pairId: d.pair_id, partnerUid: d.partner_uid };
}

/**
 * End the partnership. Flips it to `ended` and tears down BOTH singleton
 * pointers — mine (owner grant) and the ex-partner's (L30 cross-tree unpair
 * grant: their pointer names me). BLOCK additionally stamps `blocked_by: me`,
 * resolving the blocked party to the wipe-identical "no longer connected".
 */
async function endPartnership(block: boolean): Promise<void> {
  const me = requireUid();
  const ptr = await readMyPointer();
  if (!ptr) return; // already solo — nothing to end

  const batch = writeBatch(db);
  batch.update(doc(db, 'partnerships', ptr.pairId), {
    status: 'ended',
    ended_at: serverTimestamp(),
    ...(block ? { blocked_by: me } : {}),
  });
  batch.delete(doc(db, 'users', me, 'partner', 'current'));
  batch.delete(doc(db, 'users', ptr.partnerUid, 'partner', 'current'));
  await batch.commit();
}

/** Neutral, one-tap end (re-pairable later). */
export function removePartner(): Promise<void> {
  return endPartnership(false);
}

/** Irreversible end + block (S7.3 confirms before calling). */
export function blockPartner(): Promise<void> {
  return endPartnership(true);
}

/**
 * Toggle MY share-consent on the active partnership (L28: explicit, default-OFF,
 * per-member, revocable). The `share_consent.${me}` dot-path touches ONLY my key,
 * leaving my partner's untouched — exactly what the consent-self-toggle rule
 * branch expects. No-op when solo. S7.2 wires the one-tap toggle to this.
 */
export async function setShareConsent(value: boolean): Promise<void> {
  const me = requireUid();
  const ptr = await readMyPointer();
  if (!ptr) return; // solo — nothing to consent to
  await updateDoc(doc(db, 'partnerships', ptr.pairId), {
    [`share_consent.${me}`]: value,
  });
}
