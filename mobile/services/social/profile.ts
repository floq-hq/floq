// Partner-visible display-name projection (M7.1).
//
// The raw users/{uid}.display_name is owner-private free text editable any time.
// A partner reads ONLY this projected `users/{uid}/social/profile.display_name`,
// sanitized at the boundary. Unlike summary/presence it is gated on isPartner
// WITHOUT consent (you can see your partner's NAME — you invited them — which
// powers the dormant "{name} joined" state; you can't see their focus DATA until
// they consent). Self-write only; fired on createInvite + acceptInvite +
// display-name edit, so each member projects their OWN name.
//
// React-free; best-effort.

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/init';
import { auth } from '../firebase/auth';
import { sanitizeDisplayNameForPartner } from './sanitizeName';

/** Project the current user's display name to their partner-readable profile. */
export async function projectDisplayName(rawName: string): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) return;
  await setDoc(
    doc(db, 'users', me, 'social', 'profile'),
    { display_name: sanitizeDisplayNameForPartner(rawName), updated_at: serverTimestamp() },
    { merge: true },
  );
}

/**
 * Backfill for pairs formed before M7.1 (no profile projected yet): if the
 * current user has no social/profile doc, project it once from their Auth display
 * name. Cheap, idempotent, best-effort — call on app foreground.
 */
export async function ensureOwnProfileProjected(): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) return;
  try {
    const snap = await getDoc(doc(db, 'users', me, 'social', 'profile'));
    if (snap.exists()) return;
    await projectDisplayName(auth.currentUser?.displayName ?? '');
  } catch {
    // best-effort; self-heals on a later foreground
  }
}
