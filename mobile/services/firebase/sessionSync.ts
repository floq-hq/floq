// Cross-device session sync — the PULL-DOWN half (sessions first).
//
// Sessions already flow UP to users/{uid}/sessions/{id} (writeSession in
// distraction.ts). This module is the missing read-back: a real-time onSnapshot
// listener that hands the remote session set to a callback, which upserts it into
// local SQLite (the durable source of truth) so Stats/streak reflect every device.
//
// Sessions are IMMUTABLE + id-keyed, so the merge is a conflict-free union — see
// upsertRemoteSessions (storage/sessions.ts), which reuses the idempotent
// INSERT OR REPLACE. fromSessionDoc is the exact reverse of toSessionDoc
// (distraction.ts); keep the two in lockstep.
//
// Owner-only own-data sync: the M2.2 rule (users/{uid}/**) already authorizes the
// read on any device signed into the same account — no rules change. taskId and
// the L23 feature vector are intentionally NOT in the Firestore doc (local-only),
// so a pulled session carries taskId '' (stats don't use it) and no features.

import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from './init';
import type { CompletedSession } from '../session/types';
import type { SessionPlan } from '../timer';

/** A Firestore Timestamp (or already-ms number) → epoch ms. Defensive: a missing
 *  / malformed field reads as 0 rather than throwing the whole listener. */
function toMs(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

/** Reverse of toSessionDoc (services/session/distraction.ts): a sessions/{id}
 *  Firestore doc → CompletedSession for the local upsert. */
export function fromSessionDoc(d: Record<string, unknown>): CompletedSession {
  const task = (d.task ?? {}) as { title?: string; difficulty?: number; est_minutes?: number };
  const distractions = Array.isArray(d.distraction_timestamps)
    ? (d.distraction_timestamps as unknown[]).map(toMs)
    : [];
  return {
    id: String(d.id),
    taskId: '', // not stored in the doc; stats don't need it
    task: {
      title: task.title ?? '',
      difficulty: (task.difficulty ?? 3) as CompletedSession['task']['difficulty'],
      estMinutes: task.est_minutes ?? 0,
    },
    plan: {
      focusMinutes: Number(d.planned_focus_minutes ?? 0),
      breakMinutes: Number(d.break_minutes ?? 0),
      regime: (d.regime ?? 'cold') as SessionPlan['regime'],
    },
    startedAt: toMs(d.started_at),
    endedAt: toMs(d.ended_at),
    actualFocusMinutes: Number(d.actual_focus_minutes ?? 0),
    focusScore: Number(d.focus_score ?? 0),
    distractions,
    completed: Boolean(d.completed),
    overrunMinutes: Number(d.overrun_minutes ?? 0),
    clientVersion: String(d.client_version ?? ''),
    ...(d.model_version ? { modelVersion: String(d.model_version) } : {}),
  };
}

/**
 * Subscribe to the signed-in user's sessions in real time. onSnapshot fires an
 * initial snapshot on subscribe (so a fresh device backfills all history at once)
 * then live deltas. Returns the unsubscribe handle — the caller tears it down on
 * sign-out / uid change. `onError` is optional; a listener error must not crash
 * the app (network blips are normal).
 */
export function subscribeRemoteSessions(
  uid: string,
  onSessions: (sessions: CompletedSession[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'sessions'),
    (snap) => onSessions(snap.docs.map((doc) => fromSessionDoc(doc.data() as Record<string, unknown>))),
    (error) => onError?.(error),
  );
}
