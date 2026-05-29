// Distraction logging + session-end persistence (M3.2).
//
// `logDistraction` is the single funnel for "a distraction happened" — the S3.2
// button and (later) M3.4's background policy both call it. It appends to the
// active-session store optimistically (instant, no network): distractions are
// batched to session end, not written per tap.
//
// `writeSession` performs the session-end write: one atomic setDoc of the
// completed session to users/{uid}/sessions/{id} — the "single transaction",
// all distractions in one write. The caller assembles the CompletedSession at
// Done (S3.3), supplying the focus score (M4.1) and actual focused minutes that
// M3.2 cannot know. The doc is append-only; M4.2 later supersedes this direct
// write with a SQLite-sourced mirror. Firestore rules already authorize the
// owner write (M2.2's users/{uid}/{document=**}).

import { doc, setDoc, Timestamp } from 'firebase/firestore';
import { auth } from '../firebase/auth';
import { db } from '../firebase/init';
import { useActiveSessionStore } from '../../stores/useActiveSessionStore';
import type { CompletedSession } from './types';

/** Record one distraction on the active session. No-ops if no session runs. */
export function logDistraction(timestamp: number = Date.now()): void {
  useActiveSessionStore.getState().logDistraction(timestamp);
}

/** Pure: map an in-app CompletedSession to the Firestore sessions/{id} payload
 *  (schema.md). Epoch-ms → Timestamp; distraction_count derived from the array;
 *  task.estMinutes → est_minutes. `completed` + `overrun_minutes` ship in the
 *  mirror payload alongside the SQLite columns (M4.5 / M4.6 / L16). */
export function toSessionDoc(s: CompletedSession) {
  return {
    id: s.id,
    started_at: Timestamp.fromMillis(s.startedAt),
    ended_at: Timestamp.fromMillis(s.endedAt),
    planned_focus_minutes: s.plan.focusMinutes,
    actual_focus_minutes: s.actualFocusMinutes,
    break_minutes: s.plan.breakMinutes,
    distraction_count: s.distractions.length,
    distraction_timestamps: s.distractions.map((ms) => Timestamp.fromMillis(ms)),
    task: {
      title: s.task.title,
      difficulty: s.task.difficulty,
      est_minutes: s.task.estMinutes,
    },
    focus_score: s.focusScore,
    regime: s.plan.regime,
    client_version: s.clientVersion,
    completed: s.completed,
    overrun_minutes: s.overrunMinutes,
    ...(s.modelVersion ? { model_version: s.modelVersion } : {}),
  };
}

/** Write the completed session to users/{uid}/sessions/{id} in a single atomic
 *  doc write. Throws if signed out. Append-only — never edits an existing doc. */
export async function writeSession(s: CompletedSession): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) {
    throw new Error('[session] writeSession: no signed-in user.');
  }
  await setDoc(doc(db, 'users', uid, 'sessions', s.id), toSessionDoc(s));
}
