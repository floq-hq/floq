// Active-session store (M3.2) — the in-app source of truth for the single
// in-flight focus session (start time, phase, distraction timestamps).
//
// Follows the house pattern (see useTaskStore): NO zustand `persist` middleware;
// the store is the React facade + impure boundary; it write-throughs to the MMKV
// mirror in services/session/activeSessionPersist on every mutation, so a
// distraction logged just before an app kill survives the relaunch. The store
// imports the persist service; never the reverse.

import { create } from 'zustand';
import {
  clearActiveSession,
  loadActiveSession,
  saveActiveSession,
} from '../services/session/activeSessionPersist';
import type { ActiveSession, SessionTask } from '../services/session/types';
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
  reset: () => void;
}

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

    reset: () => {
      clearActiveSession();
      set({ active: null, hydrated: false });
    },
  };
});
