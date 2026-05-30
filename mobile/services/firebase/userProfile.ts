// User profile read/update (Account screen).
//
// Reads + edits the app-canonical profile fields on `users/{uid}` (created by
// ensureUserDoc, M2.4 / L13). The owner-only Firestore rule (M2.2) already
// authorizes a signed-in user to read and update their OWN doc, so this needs
// no rules change. Display-name edits also sync the Firebase Auth user's
// `displayName` so the two copies don't drift (other surfaces read either).
//
// Avatar is intentionally NOT stored here: the Account screen uses the provider
// photo (`auth.currentUser.photoURL` from Google/Apple) with an initials
// fallback — no Firebase Storage, no schema field (custom upload is deferred,
// it needs the paid Blaze plan).

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { db, auth, useCurrentUser } from './index';

/** The editable/displayable slice of `users/{uid}`. `createdAt` is normalized to
 *  epoch-ms (the stored value is a Firestore Timestamp; null while the
 *  serverTimestamp write is still pending on a fresh account). */
export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  createdAt: number | null;
  privacy: 'private' | 'friends';
}

/** Firestore stores epoch via serverTimestamp() → a Timestamp with toMillis().
 *  Be defensive: accept a Timestamp, a raw number, or a pending null. */
function toMillis(value: unknown): number | null {
  if (typeof value === 'number') return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

/** Read the current user's profile from `users/{uid}`. Returns null if the doc
 *  is missing (shouldn't happen post-sign-in, but the caller renders a fallback
 *  rather than throwing). */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  const d = snap.data() as Record<string, unknown>;
  return {
    uid,
    email: typeof d.email === 'string' ? d.email : '',
    displayName: typeof d.display_name === 'string' ? d.display_name : '',
    createdAt: toMillis(d.created_at),
    privacy: d.privacy === 'friends' ? 'friends' : 'private',
  };
}

/** Update the display name on both `users/{uid}` (app-canonical, merge so other
 *  fields are untouched) and the Firebase Auth user (so `user.displayName` stays
 *  in sync). Trims; rejects empty so the UI can guard before calling. */
export async function updateDisplayName(uid: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('[userProfile] updateDisplayName: name must not be empty.');
  }
  await setDoc(doc(db, 'users', uid), { display_name: trimmed }, { merge: true });
  if (auth.currentUser) {
    await updateProfile(auth.currentUser, { displayName: trimmed });
  }
}

/** The current user's profile, via TanStack Query. Gated on the signed-in uid
 *  (`enabled`) so it doesn't fire before auth resolves; key includes the uid so
 *  switching accounts can't serve a stale profile. Pair with useCurrentUser()
 *  for the live `photoURL` (provider avatar) the Account screen renders. */
export function useUserProfile(): UseQueryResult<UserProfile | null> {
  const { user } = useCurrentUser();
  const uid = user?.uid;
  return useQuery({
    queryKey: ['user', 'profile', uid],
    queryFn: () => getUserProfile(uid as string),
    enabled: !!uid,
  });
}
