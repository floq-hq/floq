// First-session framing card "seen" flag (S2.5).
//
// MMKV mirror of `users.has_seen_intro` (root CLAUDE.md lists has_seen_intro as
// an MMKV pref). The Firestore field is the cross-device source of truth (set
// false on signup by M2.4's ensureUserDoc); syncing the two is a later W4
// integration — for now this device-local flag gates the one-time card.

import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV();

export const HAS_SEEN_INTRO_KEY = 'floq.hasSeenIntro';

/** Has the framing card been shown (and finished) on this device? */
export function getHasSeenIntro(): boolean {
  return storage.getBoolean(HAS_SEEN_INTRO_KEY) ?? false;
}

/** Mark the framing card as seen — set by the "Got it, let's go" button. */
export function markIntroSeen(): void {
  storage.set(HAS_SEEN_INTRO_KEY, true);
}
