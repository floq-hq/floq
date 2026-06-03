// Coarse live presence (M7.1) — the partner-visible "what are they doing right
// now" beat. Owner-written at session boundaries + sign-out; a consented partner
// reads it (gated by the firestore.rules partnerCanRead predicate). Timestamps
// are epoch-ms NUMBERS (not serverTimestamp) so derivePresence can clamp
// freshness against Date.now() on the reader's device.
//
// React-free. All writes are best-effort fire-and-forget — presence is ephemeral
// and must NEVER throw into a session path or the sign-out teardown.

import {
  type Unsubscribe,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import { db } from '../firebase/init';
import { auth } from '../firebase/auth';
import type { Phase } from '../timer';
import type { PresenceDoc } from './derivePresence';

function uid(): string | null {
  return auth.currentUser?.uid ?? null;
}

function presenceRef(forUid: string) {
  return doc(db, 'presence', forUid);
}

/** Session start → live "focusing". `startedAt` MUST be the same epoch-ms the
 *  active-session store committed (the staleness clamp keys on it). */
export async function writePresenceFocusing(startedAt: number, phase: Phase): Promise<void> {
  const me = uid();
  if (!me) return;
  await setDoc(presenceRef(me), { state: 'focusing', phase, started_at: startedAt });
}

/** A completed session → "just_finished" (the celebratory beat), carrying the
 *  coarse score/minutes the partner card shows. Decays via ended_at. */
export async function writePresenceJustFinished(p: {
  score: number;
  minutes: number;
  endedAt: number;
  phase: Phase;
}): Promise<void> {
  const me = uid();
  if (!me) return;
  await setDoc(presenceRef(me), {
    state: 'just_finished',
    phase: p.phase,
    ended_at: p.endedAt,
    score: p.score,
    minutes: p.minutes,
  });
}

/** Sign-out → idle, so a signed-out user never reads as forever-focusing. Full
 *  replace clears started_at/ended_at. Caller fires this BEFORE revoking auth. */
export async function writePresenceIdle(): Promise<void> {
  const me = uid();
  if (!me) return;
  await setDoc(presenceRef(me), { state: 'idle' });
}

/** Owner-delete (wipe / account delete enumerate this in the lifecycle slice). */
export async function deletePresence(): Promise<void> {
  const me = uid();
  if (!me) return;
  await deleteDoc(presenceRef(me));
}

/** One-shot read of a partner's raw presence doc (null if absent). */
export async function getPresenceOnce(forUid: string): Promise<PresenceDoc | null> {
  const snap = await getDoc(presenceRef(forUid));
  return snap.exists() ? (snap.data() as PresenceDoc) : null;
}

/** Live subscription to a partner's presence (the ONE allowed listener — Partner
 *  tab only, never the session screen). Dev-logs errors; returns the unsubscribe. */
export function subscribePresence(
  forUid: string,
  onChange: (doc: PresenceDoc | null) => void,
): Unsubscribe {
  return onSnapshot(
    presenceRef(forUid),
    (snap) => onChange(snap.exists() ? (snap.data() as PresenceDoc) : null),
    (error) => {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[presence] partner presence listener error', error);
      }
    },
  );
}
