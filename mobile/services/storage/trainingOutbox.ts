// On-device ML training outbox (L23) — SQLite staging for anonymized training
// samples (migration 004). Capture is L2-CLEAN: rows are written at session save
// and never leave the device here. A later, consent-gated flush (separate PR)
// reads settled un-uploaded rows and uploads them; this module is the storage
// layer only — it does NO network I/O and reads NO consent.
//
// A row holds the encoded feature vector + scalar outcomes + provenance, plus
// two telemetry-state columns: `task_completed` (resolved later via the L19
// recovery Mark-task-done signal) and `uploaded`. NO task title / uid / free
// text ever lands here (L4).
//
// Synchronous (expo-sqlite sync API); no React.

import { getDb } from '../../models/db';
import { modelVersionFor } from '../ml/modelVersion';
import type { CompletedSession } from '../session/types';

/** A settled sample ready to upload (the egress PR maps this → the anonymized
 *  Firestore doc). Field names mirror the `training_samples` schema (L23). */
export interface TrainingSample {
  sessionId: string;
  features: number[];
  focusScore: number;
  actualFocusMinutes: number;
  plannedFocusMinutes: number;
  regime: CompletedSession['plan']['regime'];
  modelVersion: string;
  taskCompleted: boolean;
  createdAt: number;
}

interface OutboxRow {
  session_id: string;
  features: string;
  focus_score: number;
  actual_focus_minutes: number;
  planned_focus_minutes: number;
  regime: string;
  model_version: string;
  task_completed: number;
  created_at: number;
}

/** Stage a session's anonymized training sample locally (called at session save,
 *  L23). No-op if the plan carries no captured feature vector (e.g. a restore of
 *  a pre-L23 session). Idempotent on session id (INSERT OR REPLACE). */
export function enqueueTrainingSample(s: CompletedSession): void {
  const features = s.plan.features;
  if (!features || features.length === 0) return;
  getDb().runSync(
    `INSERT OR REPLACE INTO training_outbox
       (session_id, features, focus_score, actual_focus_minutes,
        planned_focus_minutes, regime, model_version, task_completed,
        created_at, uploaded)
     VALUES (?, ?, ?, ?, ?, ?, ?,
        COALESCE((SELECT task_completed FROM training_outbox WHERE session_id = ?), 0),
        ?, 0)`,
    s.id,
    JSON.stringify(Array.from(features)),
    s.focusScore,
    s.actualFocusMinutes,
    s.plan.focusMinutes,
    s.plan.regime,
    modelVersionFor(s.plan.regime),
    s.id, // preserve a task_completed already set by an earlier recovery tap
    s.endedAt,
  );
}

/** Mark the session's task as completed (the L19 recovery Mark-task-done signal,
 *  which lands after the row was enqueued). Safe to call for an unknown id. */
export function setTaskCompleted(sessionId: string): void {
  getDb().runSync(
    'UPDATE training_outbox SET task_completed = 1 WHERE session_id = ?',
    sessionId,
  );
}

/** Un-uploaded rows that are SETTLED and ready to flush. "Settled" = a strictly
 *  newer session row exists (the user has moved past this one's recovery, so
 *  task_completed is final) OR the row is older than `graceMs` (catches the last
 *  session before the app closed, which has no newer row). Until then a row is
 *  held back so its task_completed can still flip. */
export function takeSettledUnuploaded(
  now: number = Date.now(),
  graceMs: number = 60 * 60 * 1000,
): TrainingSample[] {
  const rows = getDb().getAllSync<OutboxRow>(
    `SELECT session_id, features, focus_score, actual_focus_minutes,
            planned_focus_minutes, regime, model_version, task_completed, created_at
       FROM training_outbox
      WHERE uploaded = 0
        AND ( created_at < (SELECT MAX(created_at) FROM training_outbox)
              OR created_at <= ? )
      ORDER BY created_at ASC`,
    now - graceMs,
  );
  return rows.map((r) => ({
    sessionId: r.session_id,
    features: JSON.parse(r.features) as number[],
    focusScore: r.focus_score,
    actualFocusMinutes: r.actual_focus_minutes,
    plannedFocusMinutes: r.planned_focus_minutes,
    regime: r.regime as TrainingSample['regime'],
    modelVersion: r.model_version,
    taskCompleted: Boolean(r.task_completed),
    createdAt: r.created_at,
  }));
}

/** Mark a sample uploaded so the flush never re-sends it. */
export function markUploaded(sessionId: string): void {
  getDb().runSync(
    'UPDATE training_outbox SET uploaded = 1 WHERE session_id = ?',
    sessionId,
  );
}

/** Wipe the outbox — part of the sign-out teardown (mirrors deleteAllSessions);
 *  un-uploaded local samples must not survive an account switch. */
export function deleteAllTrainingSamples(): void {
  getDb().runSync('DELETE FROM training_outbox');
}
