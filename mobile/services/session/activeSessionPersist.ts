// Active-session persistence (M3.2).
//
// The in-flight session is mirrored to one atomic MMKV blob under
// `floq.session.active` so a distraction logged moments before an app kill
// survives the relaunch (the session screen rehydrates from here). Mirrors the
// pattern in services/tasks/persist.ts — sync, React-free, safe-default on a
// missing/corrupt blob. This is the LOCAL active-session mirror only; the
// completed-session Firestore write lives in services/session/distraction.ts.

import { createMMKV } from 'react-native-mmkv';
import type { ActiveSession } from './types';

export const ACTIVE_SESSION_KEY = 'floq.session.active';

const storage = createMMKV();

/** Persist the in-flight session as one atomic blob. Synchronous. */
export function saveActiveSession(session: ActiveSession): void {
  storage.set(ACTIVE_SESSION_KEY, JSON.stringify(session));
}

/** Read the in-flight session. Returns null on a fresh install or a
 *  corrupt/unrecognizable blob (rather than crashing the session screen). */
export function loadActiveSession(): ActiveSession | null {
  const raw = storage.getString(ACTIVE_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && typeof parsed.sessionId === 'string') {
      return parsed as ActiveSession;
    }
    return null;
  } catch {
    return null;
  }
}

/** Clear the persisted session (on session end / store reset). */
export function clearActiveSession(): void {
  storage.remove(ACTIVE_SESSION_KEY);
}
