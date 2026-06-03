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
// It ALSO severs any active partnership (M7.3, NEVER-CUT privacy floor): a wiped
// user must be FULLY unreadable by their (ex-)partner, which means tearing down the
// co-owned partnership edge — not just the projections — so the partner-read grants
// (incl. the NAME) stop matching. See the teardown block in wipeRemoteUserData.
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
  type DocumentReference,
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

/** Delete a fixed set of single docs in parallel — the standardized counterpart
 *  to deleteSubcollection for the one-off projection egress points (no pagination
 *  needed; the set is small and known). */
async function deleteDocs(refs: DocumentReference[]): Promise<void> {
  await Promise.all(refs.map((ref) => deleteDoc(ref)));
}

/**
 * Erase the signed-in user's session + task mirror + partner-visible projections
 * from Firestore, sever any active partnership (M7.3), then stamp the wipe tombstone.
 * Awaited by the clear-history flow BEFORE the local wipe, so the next sync snapshot
 * is empty and nothing resurrects. Rejects on a write error (e.g. offline) — the
 * caller surfaces it rather than clearing local-only (which would let the cloud copy
 * sync back).
 */
export async function wipeRemoteUserData(uid: string): Promise<void> {
  await deleteSubcollection(uid, 'sessions');
  await deleteSubcollection(uid, 'tasks');
  // M7.2: reactions I RECEIVED (my own subtree). My live reaction WRITTEN in my
  // current partner's tree is torn down by the M7.3 partnership-sever block below
  // (the same ungated reactor-delete grant). analytics_events is uid-linked but
  // create-only by design (NOT deletable — like training_samples), so it's
  // intentionally not part of the wipe.
  await deleteSubcollection(uid, 'reactions');
  // M7.1 partner-visible projections: "Clear history" must also erase what a
  // CURRENT partner can still read, or a wiped user's last-session minutes/score
  // (social/summary) and live state (presence) stay visible on their partner's
  // device. All three are own-tree (owner-only rules authorize the delete).
  await deleteDocs([
    doc(db, 'users', uid, 'social', 'summary'),
    doc(db, 'users', uid, 'social', 'profile'),
    doc(db, 'presence', uid),
  ]);
  // M7.3 (NEVER-CUT privacy floor): deleting the projections is NOT enough — while
  // the partnership stays `active`, isPartner() is still true for the ex-partner, so
  // the NAME projection becomes readable again the instant anything re-creates it
  // (projectDisplayName fires on every invite/accept/display-name edit). So the wipe
  // must SEVER the edge, exactly as endPartnership (partners.ts) does for REMOVE: flip
  // partnerships/{pairId} → ended and tear down BOTH pointers + the cross-tree reaction
  // I wrote. Inlined here (vs reusing removePartner) to keep this function uid-param'd
  // and its unit test free of partners.ts module side-effects. This is the L30 grant.
  // Hard + awaited (no longer best-effort): a wiped user being fully unreadable is the
  // floor, and a failure must reject the wipe (the caller then keeps local intact).
  const ptr = await getDoc(doc(db, 'users', uid, 'partner', 'current'));
  if (ptr.exists()) {
    const { pair_id, partner_uid } = ptr.data() as { pair_id: string; partner_uid: string };
    const teardown = writeBatch(db);
    // active → ended (L30 update branch (b)); share_consent left untouched ⇒ frozen.
    teardown.update(doc(db, 'partnerships', pair_id), {
      status: 'ended',
      ended_at: serverTimestamp(),
    });
    teardown.delete(doc(db, 'users', uid, 'partner', 'current')); // mine (owner grant)
    teardown.delete(doc(db, 'users', partner_uid, 'partner', 'current')); // theirs (L30 grant)
    teardown.delete(doc(db, 'users', partner_uid, 'reactions', uid)); // my live reaction
    await teardown.commit();
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
