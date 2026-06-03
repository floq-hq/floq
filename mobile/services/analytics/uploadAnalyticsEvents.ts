// Analytics egress (M7.2) — the always-on UPLOAD half (NO consent gate, unlike
// flushTrainingSamples). Reads un-uploaded rows from analyticsOutbox and creates
// one `analytics_events/{eventId}` doc each, then marks the row uploaded.
//
// Idempotency: the deterministic eventId means a retry hits the SAME id; the
// create-only rule denies an overwrite. A `permission-denied` is ambiguous —
// "already exists (a dup retry)" vs "rule rejected (malformed/transient)" — so on
// the denied path we PROBE getDoc(): if the doc exists it was a dup → mark
// uploaded (recorded exactly once); if not, leave it for the next flush (avoids a
// genuinely-rejected row looping forever and a dup never settling).
//
// Best-effort, fire-and-forget. React-free.

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/init';
import { auth } from '../firebase/auth';
import {
  markEventUploaded,
  takeUnuploadedEvents,
  type AnalyticsEventRow,
} from '../storage/analyticsOutbox';

/** Pure: stage row → the `analytics_events` doc. `ts` stays the capture-time
 *  NUMBER (offline-truthful), NOT a server clock — an event replayed days later
 *  must carry when it actually happened. */
export function toAnalyticsEventDoc(row: AnalyticsEventRow) {
  return {
    uid: row.uid,
    name: row.name,
    ts: row.ts,
    seq: row.seq,
    kind: row.kind,
    props: row.props,
  };
}

export async function flushAnalyticsEvents(): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) return; // the create rule requires an authed client

  for (const row of takeUnuploadedEvents()) {
    if (row.uid !== me) continue; // never upload another account's staged rows
    const ref = doc(db, 'analytics_events', row.eventId);
    try {
      await setDoc(ref, toAnalyticsEventDoc(row));
      markEventUploaded(row.eventId);
    } catch {
      // dup (already committed) vs genuine reject — probe to decide.
      try {
        if ((await getDoc(ref)).exists()) markEventUploaded(row.eventId);
      } catch {
        // couldn't confirm — leave un-uploaded for the next flush
      }
    }
  }
}
