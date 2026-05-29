// Session restore (M4.5 / L16).
//
// On app launch, if `floq.session.active` (the M3.2 MMKV mirror) is non-null,
// a session was active when the app was killed. `getRestorableSession()` lets
// the launcher detect that *before* hydration (it reads MMKV directly, not the
// Zustand store, which may not have hydrated yet). `resolveRestore(action)`
// performs the user's choice — Resume / Save / Discard — driven by the M4.8
// RestoreSessionPrompt.
//
// Pure-ish: no React, no rendering. Save writes through the same finalize
// pipeline as DONE so a partial credits real focus (L16 invariant).

import { saveCompletedSession } from '../storage/sessions';
import { finalizeOnAbandon } from './finalize';
import {
  clearActiveSession,
  loadActiveSession,
} from './activeSessionPersist';
import type { ActiveSession } from './types';

/** App version stamped on a restore-time partial. Matches focus.tsx's
 *  CLIENT_VERSION (kept duplicated for now — single source lands when we add
 *  expo-constants; not worth a new module here). */
const CLIENT_VERSION = '1.0.0';

/** The dangling active session if one exists in the MMKV mirror, else null.
 *  Safe to call before `useActiveSessionStore.hydrate()` — reads MMKV directly. */
export function getRestorableSession(): ActiveSession | null {
  return loadActiveSession();
}

/** Resolve a launch-time restore prompt. The caller (RestoreSessionPrompt)
 *  passes the user's choice; this performs the right side-effect.
 *
 *  - `'resume'` returns the session unchanged. The caller routes to `/focus`
 *    with the session's `taskId` + `plan`; `useActiveSessionStore.hydrate()`
 *    re-mounts the in-flight state.
 *  - `'save'`  writes a `completed:false` partial via the M4.6 finalize
 *    pipeline (real focus score), clears the MMKV mirror, returns the
 *    finalized snapshot for any UI affordance (e.g. a toast).
 *  - `'discard'` only clears the MMKV mirror — no SQLite write — and returns
 *    null. The task in the queue is untouched in all three branches. */
export function resolveRestore(
  action: 'resume' | 'save' | 'discard',
): ActiveSession | null {
  const active = loadActiveSession();
  if (!active) return null;

  if (action === 'resume') return active;

  if (action === 'discard') {
    clearActiveSession();
    return null;
  }

  // action === 'save'
  const partial = finalizeOnAbandon(active, Date.now(), CLIENT_VERSION);
  saveCompletedSession(partial);
  clearActiveSession();
  // We return the original ActiveSession (the in-flight shape the caller still
  // had in mind), not the CompletedSession — keeps the resolve API symmetric.
  return active;
}
