// User document bootstrap (M2.4).
//
// On first sign-up we create the users/{uid} skeleton CLIENT-SIDE (decisions.md
// L13): no Cloud Function, so the project stays on the free Spark plan. The
// owner-only Firestore rule deployed in M2.2 authorizes this — the user is
// authenticated immediately after createUser*/signInWithCredential, so
// `request.auth.uid == uid` holds.
//
// The skeleton shape is the floq-firestore skill's `users/{uid}` doc, minus the
// `onboarding` map (written later by services/onboarding/persist). We write only
// when the doc is MISSING, so a returning Google/Apple user is never clobbered.

import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './init';

export interface UserDocSeed {
  email: string;
  display_name: string;
  /** Stable Apple user id, only on Apple sign-in. */
  apple_id?: string;
}

/**
 * Ensure users/{uid} exists. No-op if the doc is already present (returning
 * user) so onboarding / has_seen_intro set on a previous device survive.
 */
export async function ensureUserDoc(
  user: { uid: string },
  seed: UserDocSeed,
): Promise<void> {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return;

  await setDoc(
    ref,
    {
      uid: user.uid,
      email: seed.email,
      display_name: seed.display_name,
      ...(seed.apple_id ? { apple_id: seed.apple_id } : {}),
      created_at: serverTimestamp(),
      has_seen_intro: false, // first-session framing card (S2.5) not yet shown
      privacy: 'private', // default per floq-firestore skill; opt into 'friends' later
    },
    { merge: true },
  );
}
