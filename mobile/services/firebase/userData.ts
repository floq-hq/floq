// User-data wipe (the "Clear history" action).
//
// Deletes the user's OWN Firestore mirror — users/{uid}/sessions/* and
// users/{uid}/tasks/* — so a cleared history can't be re-imported by the
// real-time sync listeners (useSessionSync / useTaskSync). Owner-only rules
// (M2.2) already authorize a user to delete their own docs; no rules change.
//
// NOT touched: `training_samples` (anonymized, unlinkable, create-only — can't be
// deleted, by design, L23) and the `users/{uid}` doc itself (account stays).
// This is distinct from sign-out, which clears LOCAL state but preserves the
// cloud mirror — here the user explicitly asked to erase their data.

import { collection, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from './init';

const BATCH_LIMIT = 450; // under Firestore's 500-op cap, with headroom

/** Delete every doc in a users/{uid} subcollection, in batches. */
async function deleteSubcollection(uid: string, sub: 'sessions' | 'tasks'): Promise<void> {
  const snap = await getDocs(collection(db, 'users', uid, sub));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + BATCH_LIMIT)) batch.delete(d.ref);
    await batch.commit();
  }
}

/**
 * Erase the signed-in user's session + task mirror from Firestore. Awaited by the
 * clear-history flow BEFORE the local wipe, so the next sync snapshot is empty and
 * nothing resurrects. Rejects on a write error (e.g. offline) — the caller surfaces
 * it rather than clearing local-only (which would let the cloud copy sync back).
 */
export async function wipeRemoteUserData(uid: string): Promise<void> {
  await deleteSubcollection(uid, 'sessions');
  await deleteSubcollection(uid, 'tasks');
}
