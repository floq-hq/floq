// User-data wipe (the "Clear history" action).
//
// Deletes the user's OWN Firestore mirror — users/{uid}/sessions/* and
// users/{uid}/tasks/* — so a cleared history can't be re-imported by the
// real-time sync listeners (useSessionSync / useTaskSync). Owner-only rules
// (M2.2) already authorize a user to delete their own docs; no rules change.
//
// It ALSO stamps a wipe tombstone on users/{uid}.data_cleared_at. Deleting the
// docs is not enough for cross-device propagation: the pull-down listeners are
// upsert / last-write-wins only, so a SECOND signed-in device sees an empty
// snapshot, keeps its local copy, and can re-push it (resurrecting the data).
// The tombstone is the explicit, timestamped "this was cleared" event that
// useDataWipeSync watches to clear the other device too.
//
// NOT touched: `training_samples` (anonymized, unlinkable, create-only — can't be
// deleted, by design, L23) and the rest of the `users/{uid}` doc (account stays).
// This is distinct from sign-out, which clears LOCAL state but preserves the
// cloud mirror — here the user explicitly asked to erase their data.

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './init';
import { setWipeSelfInitiated } from '../sync/wipeMarker';

const BATCH_LIMIT = 450; // under Firestore's 500-op cap, with headroom

/** A Firestore Timestamp (or already-ms number / pending null) → epoch ms (0 if
 *  absent — e.g. the field has never been set, or a pending serverTimestamp). */
function toMs(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

/** Delete every doc in a users/{uid} subcollection, in batches. */
async function deleteSubcollection(
  uid: string,
  sub: 'sessions' | 'tasks' | 'reactions',
): Promise<void> {
  const snap = await getDocs(collection(db, 'users', uid, sub));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const d of docs.slice(i, i + BATCH_LIMIT)) batch.delete(d.ref);
    await batch.commit();
  }
}

/**
 * Erase the signed-in user's session + task mirror from Firestore, then stamp the
 * wipe tombstone. Awaited by the clear-history flow BEFORE the local wipe, so the
 * next sync snapshot is empty and nothing resurrects. Rejects on a write error
 * (e.g. offline) — the caller surfaces it rather than clearing local-only (which
 * would let the cloud copy sync back).
 */
export async function wipeRemoteUserData(uid: string): Promise<void> {
  await deleteSubcollection(uid, 'sessions');
  await deleteSubcollection(uid, 'tasks');
  // M7.2: reactions I RECEIVED (my own subtree) + my live reaction in my current
  // partner's tree (the ungated reactor-delete grant authorizes the latter).
  // analytics_events is uid-linked but create-only by design (NOT deletable —
  // like training_samples), so it's intentionally not part of the wipe. A
  // reaction orphaned in an ENDED partner's tree is unreachable post-unpair but
  // invisible (the ended edge denies all reads) — endPartnership cleans the live
  // one at unpair time.
  await deleteSubcollection(uid, 'reactions');
  // M7.1 partner-visible projections: "Clear history" must also erase what a
  // CURRENT partner can still read, or a wiped user's last-session minutes/score
  // (social/summary) and live state (presence) stay visible on their partner's
  // device. All three are own-tree (owner-only rules authorize the delete).
  await Promise.all([
    deleteDoc(doc(db, 'users', uid, 'social', 'summary')),
    deleteDoc(doc(db, 'users', uid, 'social', 'profile')),
    deleteDoc(doc(db, 'presence', uid)),
  ]);
  try {
    const ptr = await getDoc(doc(db, 'users', uid, 'partner', 'current'));
    const partnerUid = ptr.exists() ? (ptr.data().partner_uid as string | undefined) : undefined;
    if (partnerUid) await deleteDoc(doc(db, 'users', partnerUid, 'reactions', uid));
  } catch {
    // best-effort cross-tree cleanup; the wipe proper (own subtrees) already ran
  }
  // Mark self-initiated BEFORE the write so our OWN tombstone echo (which arrives
  // via useDataWipeSync) only advances the marker and does not re-run the local
  // wipe over anything created right after the clear. Set only after the deletes
  // succeed — if we're offline the deletes throw first and the flag is never set.
  setWipeSelfInitiated();
  await setDoc(doc(db, 'users', uid), { data_cleared_at: serverTimestamp() }, { merge: true });
}

/**
 * Subscribe to the signed-in user's wipe tombstone (users/{uid}.data_cleared_at)
 * in real time. Fires the current value on subscribe (so a device that was offline
 * during a wipe catches up on reconnect) then live updates. Skips local-pending
 * snapshots so the caller only ever sees the SERVER-resolved timestamp, never the
 * optimistic null of our own write. Returns the unsubscribe handle.
 */
export function subscribeDataCleared(
  uid: string,
  onCleared: (clearedAtMs: number) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.metadata.hasPendingWrites) return; // wait for the server timestamp
      onCleared(toMs(snap.get('data_cleared_at')));
    },
    (error) => onError?.(error),
  );
}
