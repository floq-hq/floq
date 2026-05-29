// Active-session store (M3.2 + M4.5) — the in-app source of truth for the
// single in-flight focus session (start time, phase, distraction timestamps).
//
// Follows the house pattern (see useTaskStore): NO zustand `persist` middleware;
// the store is the React facade + impure boundary; it write-throughs to the MMKV
// mirror in services/session/activeSessionPersist on every mutation, so a
// distraction logged just before an app kill survives the relaunch. The store
// imports the persist service; never the reverse.
//
// M4.5 (L16): `abandonSession()` ends the session as a saved partial (writes a
// `completed:false` row via the finalize pipeline, then clears the mirror);
// `getRestorableSession()` reads the MMKV mirror directly so the launcher can
// detect a dangling session before hydration.

import { create } from 'zustand';
import {
  clearActiveSession,
  loadActiveSession,
  saveActiveSession,
} from '../services/session/activeSessionPersist';
import { finalizeOnAbandon } from '../services/session/finalize';
import { saveCompletedSession } from '../services/storage/sessions';
import type {
  ActiveSession,
  CompletedSession,
  SessionTask,
} from '../services/session/types';
import type { Phase, SessionPlan } from '../services/timer';

export interface StartSessionInput {
  taskId: string;
  task: SessionTask;
  plan: SessionPlan;
}

interface ActiveSessionState {
  /** The in-flight session, or null between sessions. */
  active: ActiveSession | null;
  /** True once hydrate() has run (lets the UI avoid a flash before load). */
  hydrated: boolean;

  hydrate: () => void;
  startSession: (input: StartSessionInput) => void;
  logDistraction: (timestamp?: number) => void; // optimistic, local; batched to end
  setPhase: (phase: Phase) => void;
  endSession: () => ActiveSession | null; // returns the snapshot, then clears
  /** End early (L16) — write a `completed:false` partial via the finalize
   *  pipeline (real focus score, no markDone — task stays in queue), then
   *  clear the mirror. Returns the CompletedSession written, or null if no
   *  session was in flight. */
  abandonSession: () => CompletedSession | null;
  /** Dangling active session in MMKV, or null. Reads MMKV directly so launch
   *  code can prompt the user before the store hydrates. */
  getRestorableSession: () => ActiveSession | null;
  reset: () => void;
}

/** App version stamped on a partial-session write. Mirrors focus.tsx's
 *  CLIENT_VERSION. (Both move to expo-constants when that dep lands.) */
const CLIENT_VERSION = '1.0.0';

/** Dependency-free local id (mirrors useTaskStore.genId). */
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export const useActiveSessionStore = create<ActiveSessionState>((set, get) => {
  // Persist the mirror, then commit to React state. null clears the blob.
  const commit = (next: ActiveSession | null) => {
    if (next) saveActiveSession(next);
    else clearActiveSession();
    set({ active: next });
  };

  return {
    active: null,
    hydrated: false,

    hydrate: () => set({ active: loadActiveSession(), hydrated: true }),

    startSession: ({ taskId, task, plan }) =>
      commit({
        sessionId: genId(),
        taskId,
        task,
        plan,
        startedAt: Date.now(),
        currentPhase: 'struggle',
        distractions: [],
      }),

    logDistraction: (timestamp = Date.now()) => {
      const { active } = get();
      if (!active) return; // no session in flight — nothing to log
      commit({ ...active, distractions: [...active.distractions, timestamp] });
    },

    setPhase: (phase) => {
      const { active } = get();
      if (!active) return;
      commit({ ...active, currentPhase: phase });
    },

    endSession: () => {
      const { active } = get();
      commit(null);
      return active;
    },

    abandonSession: () => {
      const { active } = get();
      if (!active) return null;
      const partial = finalizeOnAbandon(active, Date.now(), CLIENT_VERSION);
      // Mirror the DONE path: SQLite is the source of truth, Firestore mirror
      // is best-effort async (saveCompletedSession swallows mirror failure).
      saveCompletedSession(partial);
      commit(null);
      return partial;
    },

    getRestorableSession: () => loadActiveSession(),

    reset: () => {
      clearActiveSession();
      set({ active: null, hydrated: false });
    },
  };
});
