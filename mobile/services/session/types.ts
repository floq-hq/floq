// Active-session + completed-session shapes (M3.2).
//
// ActiveSession is the in-flight session held by useActiveSessionStore and
// mirrored to MMKV. CompletedSession is the record the session-end writer
// (distraction.ts) maps to the Firestore users/{uid}/sessions/{id} doc. Both use
// plain epoch-ms numbers (JSON/MMKV-friendly); the writer converts to Firestore
// Timestamps. Reuses timer types so the session vocabulary stays single-sourced.

import type { Phase, SessionPlan } from '../timer';

/** Snapshot of the worked-on task, captured at session start so the session
 *  record stays stable even if the task is later edited or deleted. */
export interface SessionTask {
  title: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  estMinutes: number;
}

export interface ActiveSession {
  sessionId: string;
  taskId: string;
  task: SessionTask;
  plan: SessionPlan;
  startedAt: number; // epoch ms
  currentPhase: Phase;
  distractions: number[]; // epoch-ms timestamps; count = length
}

/** The full session outcome, assembled at Done (S3.3) once the timer's elapsed
 *  minutes and the focus score (M4.1) are known, then handed to writeSession.
 *  M3.2 owns only the distraction fields; the caller supplies the rest. */
export interface CompletedSession {
  id: string;
  taskId: string;
  task: SessionTask;
  plan: SessionPlan;
  startedAt: number; // epoch ms
  endedAt: number; // epoch ms
  actualFocusMinutes: number;
  focusScore: number; // M4.1; can be negative
  distractions: number[]; // epoch-ms timestamps
  clientVersion: string;
  modelVersion?: string; // only when regime === 'mature'
}
