// Cross-device settings sync — the PULL-DOWN half (W6-sweep).
//
// Settings already mirror UP to users/{uid}.settings (firestoreMirror). This adds
// the read-back: a real-time onSnapshot on the user doc that hands the remote
// settings blob + its server-clock LWW time to a callback, which applies it
// locally IFF the remote is newer (LWW, whole blob — same policy as the task
// queue). Skips local-pending snapshots so a device never reacts to its own
// optimistic write before the server resolves `settings_updated_at`.
//
// Owner-only own-data sync (M2.2 rule) — no rules change. coerceSettings fills any
// missing/invalid field so a blob from an older build stays complete + valid.

import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase/init';
import { coerceSettings } from './persist';
import type { Settings } from './types';

/** A Firestore Timestamp (or already-ms number / pending null) → epoch ms (0 if
 *  absent — e.g. a user doc written before settings sync existed). */
function toMs(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

/**
 * Subscribe to the signed-in user's settings in real time. Fires the current
 * value on subscribe (a fresh device gets the account's settings at once) then
 * live deltas. Skips local-pending snapshots and a doc with no `settings` field
 * yet (nothing to adopt). Returns the unsubscribe handle.
 */
export function subscribeRemoteSettings(
  uid: string,
  onSettings: (settings: Settings, updatedAtMs: number) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      if (snap.metadata.hasPendingWrites) return; // ignore our own optimistic echo
      const raw = snap.get('settings');
      if (!raw || typeof raw !== 'object') return; // no settings mirrored yet
      onSettings(coerceSettings(raw), toMs(snap.get('settings_updated_at')));
    },
    (error) => onError?.(error),
  );
}
