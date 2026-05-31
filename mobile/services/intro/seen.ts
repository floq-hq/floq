// First-session framing card "seen" flag (S2.5; cross-device W6-sweep).
//
// MMKV is the fast local gate; users/{uid}.has_seen_intro is the cross-device
// source of truth (seeded false on signup by ensureUserDoc). markIntroSeen flips
// BOTH so a returning user on a new device doesn't re-see the one-time card, and
// ensureHasSeenIntroHydrated seeds the local flag from Firestore at boot.

import { createMMKV } from 'react-native-mmkv';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth } from '../firebase/auth';
import { db } from '../firebase/init';

const storage = createMMKV();

export const HAS_SEEN_INTRO_KEY = 'floq.hasSeenIntro';

/** Has the framing card been shown (and finished) on this device? */
export function getHasSeenIntro(): boolean {
  return storage.getBoolean(HAS_SEEN_INTRO_KEY) ?? false;
}

/** Mark the framing card as seen — set by the "Got it, let's go" button. Flips
 *  the local flag immediately and best-effort mirrors users/{uid}.has_seen_intro
 *  so the user's other devices skip the card too. */
export function markIntroSeen(): void {
  storage.set(HAS_SEEN_INTRO_KEY, true);
  const uid = auth.currentUser?.uid;
  if (uid) {
    void setDoc(doc(db, 'users', uid), { has_seen_intro: true }, { merge: true }).catch(() => {
      // best-effort: the local flag already gates this device; reconcile later.
    });
  }
}

/** One-shot at boot: if this device hasn't recorded the intro as seen but the
 *  account already has (set on another device), seed the local flag so the card
 *  doesn't re-show. No-op when already seen locally; offline just leaves the gate
 *  false (the card may re-show once — acceptable). */
export async function ensureHasSeenIntroHydrated(uid: string): Promise<void> {
  if (getHasSeenIntro()) return;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    if (snap.exists() && snap.get('has_seen_intro') === true) {
      storage.set(HAS_SEEN_INTRO_KEY, true);
    }
  } catch {
    // offline / transient — leave the gate false; it self-heals on a later boot.
  }
}
