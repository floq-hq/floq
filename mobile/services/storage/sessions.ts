// SQLite session CRUD (M4.2) — the durable source of truth for completed
// sessions. Supersedes M3.2's direct-to-Firestore session write: the session is
// written to SQLite first (local truth), then async-mirrored to Firestore.
//
// Powers the W4 stats layer (M4.3, getRecentSessions) and the cold-start
// fatigue input (countSessionsToday). Synchronous (expo-sqlite sync API);
// session writes happen on Done, reads belong in TanStack Query (mobile/CLAUDE.md
// — never call getRecentSessions inline on a render path). No React.

import { getDb } from '../../models/db';
import { writeSession } from '../session/distraction';
import type { CompletedSession } from '../session/types';
import type { SessionPlan } from '../timer';

interface SessionRow {
  id: string;
  task_id: string | null;
  task_title: string;
  task_difficulty: number;
  task_est_minutes: number;
  planned_focus_minutes: number;
  actual_focus_minutes: number;
  break_minutes: number;
  focus_score: number;
  regime: string;
  client_version: string;
  model_version: string | null;
  started_at: number;
  ended_at: number;
}

function rowToSession(r: SessionRow, distractions: number[]): CompletedSession {
  return {
    id: r.id,
    taskId: r.task_id ?? '',
    task: {
      title: r.task_title,
      difficulty: r.task_difficulty as CompletedSession['task']['difficulty'],
      estMinutes: r.task_est_minutes,
    },
    plan: {
      focusMinutes: r.planned_focus_minutes,
      breakMinutes: r.break_minutes,
      regime: r.regime as SessionPlan['regime'],
    },
    startedAt: r.started_at,
    endedAt: r.ended_at,
    actualFocusMinutes: r.actual_focus_minutes,
    focusScore: r.focus_score,
    distractions,
    clientVersion: r.client_version,
    ...(r.model_version ? { modelVersion: r.model_version } : {}),
  };
}

/** Persist a completed session + its distraction timestamps in one transaction.
 *  INSERT OR REPLACE keeps a retried Done idempotent (one row per session id). */
export function insertSession(s: CompletedSession): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync(
      `INSERT OR REPLACE INTO sessions
        (id, task_id, task_title, task_difficulty, task_est_minutes,
         planned_focus_minutes, actual_focus_minutes, break_minutes, focus_score,
         regime, client_version, model_version, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      s.id,
      s.taskId,
      s.task.title,
      s.task.difficulty,
      s.task.estMinutes,
      s.plan.focusMinutes,
      s.actualFocusMinutes,
      s.plan.breakMinutes,
      s.focusScore,
      s.plan.regime,
      s.clientVersion,
      s.modelVersion ?? null,
      s.startedAt,
      s.endedAt,
    );
    // Re-insert distractions cleanly on a replace.
    db.runSync('DELETE FROM distractions WHERE session_id = ?', s.id);
    for (const ts of s.distractions) {
      db.runSync('INSERT INTO distractions (session_id, ts) VALUES (?, ?)', s.id, ts);
    }
  });
}

/** Most recent sessions, newest first. Reassembles each session's distraction
 *  timestamps so the returned shape round-trips with the Firestore mirror. */
export function getRecentSessions(n = 20): CompletedSession[] {
  const db = getDb();
  const rows = db.getAllSync<SessionRow>(
    'SELECT * FROM sessions ORDER BY ended_at DESC LIMIT ?',
    n,
  );
  if (rows.length === 0) return [];

  const placeholders = rows.map(() => '?').join(', ');
  const dRows = db.getAllSync<{ session_id: string; ts: number }>(
    `SELECT session_id, ts FROM distractions WHERE session_id IN (${placeholders}) ORDER BY ts ASC`,
    ...rows.map((r) => r.id),
  );
  const bySession = new Map<string, number[]>();
  for (const d of dRows) {
    const arr = bySession.get(d.session_id) ?? [];
    arr.push(d.ts);
    bySession.set(d.session_id, arr);
  }

  return rows.map((r) => rowToSession(r, bySession.get(r.id) ?? []));
}

/** Count sessions completed today, for the cold-start fatigue modifier
 *  (timer.md context.sessions_today). DEVICE-LOCAL midnight — consistent with
 *  the wall-clock hour bucketing in services/session/compute.ts (O6 default:
 *  streaks/day boundaries follow device local time for MVP). */
export function countSessionsToday(now: number = Date.now()): number {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const row = getDb().getFirstSync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM sessions WHERE ended_at >= ?',
    midnight.getTime(),
  );
  return row?.n ?? 0;
}

/** Session-end write (supersedes the M3.2 direct Firestore write): SQLite is the
 *  source of truth, Firestore is a best-effort async mirror. A failed mirror
 *  must NOT lose the local write or throw — reconcile on a later sync. The S3.3
 *  Done handler (app/focus.tsx) should call THIS instead of writeSession. */
export function saveCompletedSession(s: CompletedSession): void {
  insertSession(s);
  void writeSession(s).catch(() => {
    // swallowed: SQLite already holds the truth; offline/signed-out is fine.
  });
}
