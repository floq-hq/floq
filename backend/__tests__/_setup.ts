// Shared harness for the Firestore rules tests (M7.0 release gate).
//
// Run via `npm run test:rules` in backend/ — `firebase emulators:exec` boots a
// Firestore emulator, loads backend/firestore.rules, and sets
// FIRESTORE_EMULATOR_HOST before vitest starts. These helpers wrap
// @firebase/rules-unit-testing so each test reads like the matrix in the plan.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc, type Firestore } from 'firebase/firestore';

export { Timestamp, doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
export { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';

const here = dirname(fileURLToPath(import.meta.url));
const RULES = readFileSync(resolve(here, '..', 'firestore.rules'), 'utf8');

let env: RulesTestEnvironment;

export async function setupEnv(): Promise<RulesTestEnvironment> {
  env = await initializeTestEnvironment({
    projectId: 'floq-rules-test',
    firestore: { rules: RULES },
  });
  return env;
}

export function teardownEnv(): Promise<void> {
  return env.cleanup();
}

export function clear(): Promise<void> {
  return env.clearFirestore();
}

/** A signed-in client's Firestore handle. */
export function authed(uid: string): Firestore {
  return env.authenticatedContext(uid).firestore() as unknown as Firestore;
}

/** An unauthenticated client's Firestore handle. */
export function unauthed(): Firestore {
  return env.unauthenticatedContext().firestore() as unknown as Firestore;
}

/** Seed fixtures with security rules disabled (so setup never depends on the rules). */
export function seed(fn: (db: Firestore) => Promise<unknown> | unknown): Promise<void> {
  return env.withSecurityRulesDisabled(async (ctx) => {
    await fn(ctx.firestore() as unknown as Firestore);
  });
}

// --- fixture builders (kept here so every suite shares one source of truth) ---

const HOUR_MS = 60 * 60 * 1000;

/** Future Timestamp helper using the admin db's Timestamp (epoch-ms based). */
export function future(ms = HOUR_MS): { toMillis: () => number } {
  // The admin context stores a real Firestore Timestamp; the test passes a
  // plain {seconds,nanoseconds}-compatible value via fromMillis at call sites.
  return { toMillis: () => Date.now() + ms };
}

/** Seed a pending invite from `fromUid` with code == doc id, valid for `ttlH` hours. */
export async function seedInvite(
  db: Firestore,
  code: string,
  fromUid: string,
  opts: { status?: string; expiresInH?: number } = {},
): Promise<void> {
  const { Timestamp } = await import('firebase/firestore');
  await setDoc(doc(db, 'partner_invites', code), {
    code,
    from_uid: fromUid,
    status: opts.status ?? 'pending',
    created_at: Timestamp.now(),
    expires_at: Timestamp.fromMillis(Date.now() + (opts.expiresInH ?? 24) * HOUR_MS),
  });
}

/** Seed a partnership doc directly (admin) in a given status. `shareConsent`
 *  defaults to `{}` (the M7.1 default-OFF); pass `omitConsent` to simulate a
 *  legacy pre-M7.1 doc with no field at all. */
export async function seedPartnership(
  db: Firestore,
  a: string,
  b: string,
  opts: {
    status?: string;
    blockedBy?: string;
    shareConsent?: Record<string, boolean>;
    omitConsent?: boolean;
  } = {},
): Promise<string> {
  const { Timestamp } = await import('firebase/firestore');
  const [m0, m1] = a < b ? [a, b] : [b, a];
  const pairId = `${m0}_${m1}`;
  await setDoc(doc(db, 'partnerships', pairId), {
    members: [m0, m1],
    status: opts.status ?? 'active',
    created_at: Timestamp.now(),
    pair_streak_days: 0,
    invite_code: 'ABCDEF',
    ...(opts.omitConsent ? {} : { share_consent: opts.shareConsent ?? {} }),
    ...(opts.blockedBy ? { blocked_by: opts.blockedBy, ended_at: Timestamp.now() } : {}),
  });
  return pairId;
}

/** Seed a presence doc directly (admin). */
export async function seedPresence(
  db: Firestore,
  uid: string,
  data: Record<string, unknown> = { state: 'focusing', started_at: Date.now() },
): Promise<void> {
  await setDoc(doc(db, 'presence', uid), data);
}

/** Seed a partner-visible social/summary or social/profile doc directly (admin). */
export async function seedSocial(
  db: Firestore,
  uid: string,
  kind: 'summary' | 'profile',
  data: Record<string, unknown>,
): Promise<void> {
  await setDoc(doc(db, 'users', uid, 'social', kind), data);
}

/** Seed a reaction doc users/{ownerUid}/reactions/{reactorUid} directly (admin). */
export async function seedReaction(
  db: Firestore,
  ownerUid: string,
  reactorUid: string,
  data: Record<string, unknown> = { kind: 'fire' },
): Promise<void> {
  const { Timestamp } = await import('firebase/firestore');
  await setDoc(doc(db, 'users', ownerUid, 'reactions', reactorUid), {
    reacted_at: Timestamp.now(),
    session_ended_at: Timestamp.now(),
    ...data,
  });
}

/** Seed a partner pointer doc directly (admin). */
export async function seedPointer(
  db: Firestore,
  ownerUid: string,
  partnerUid: string,
): Promise<void> {
  const { Timestamp } = await import('firebase/firestore');
  const [m0, m1] = ownerUid < partnerUid ? [ownerUid, partnerUid] : [partnerUid, ownerUid];
  await setDoc(doc(db, 'users', ownerUid, 'partner', 'current'), {
    pair_id: `${m0}_${m1}`,
    partner_uid: partnerUid,
    since: Timestamp.now(),
    invite_code: 'ABCDEF',
  });
}
