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
  completed: number; // M4.5: 1=DONE, 0=saved partial
  overrun_minutes: number; // M4.6
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
    completed: Boolean(r.completed),
    overrunMinutes: r.overrun_minutes,
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
         regime, client_version, model_version, started_at, ended_at,
         completed, overrun_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      s.completed ? 1 : 0,
      s.overrunMinutes,
    );
    // Re-insert distractions cleanly on a replace.
    db.runSync('DELETE FROM distractions WHERE session_id = ?', s.id);
    for (const ts of s.distractions) {
      db.runSync('INSERT INTO distractions (session_id, ts) VALUES (?, ?)', s.id, ts);
    }
  });
}

/** Join the distraction rows for a batch of session rows and return the full
 *  CompletedSession array. Single SELECT for all sessions in the batch — keeps
 *  the storage layer at most two queries per fetch regardless of N. */
function rowsToSessions(rows: SessionRow[]): CompletedSession[] {
  if (rows.length === 0) return [];

  const placeholders = rows.map(() => '?').join(', ');
  const dRows = getDb().getAllSync<{ session_id: string; ts: number }>(
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

/** Most recent sessions, newest first. Reassembles each session's distraction
 *  timestamps so the returned shape round-trips with the Firestore mirror. */
export function getRecentSessions(n = 20): CompletedSession[] {
  const rows = getDb().getAllSync<SessionRow>(
    'SELECT * FROM sessions ORDER BY ended_at DESC LIMIT ?',
    n,
  );
  return rowsToSessions(rows);
}

/** Sessions with `ended_at >= startMs`, newest first. Powers the M4.3 rolling-
 *  window aggregations (weekly focus score, distraction rate). startMs is
 *  expected to be a device-local-midnight epoch-ms; see services/stats. The
 *  M4.5 `completed` column will land later — per L16, both DONE (`completed=1`)
 *  AND saved partials (`completed=0`) feed the stats; only discarded sessions
 *  never write a row, so this query stays correct without a `completed` filter. */
export function getSessionsSince(startMs: number): CompletedSession[] {
  const rows = getDb().getAllSync<SessionRow>(
    'SELECT * FROM sessions WHERE ended_at >= ? ORDER BY ended_at DESC',
    startMs,
  );
  return rowsToSessions(rows);
}

/** Every session's `ended_at` in chronological order. Lightweight (no distraction
 *  join) — the streak calculation only needs the day-buckets timeline. Same L16
 *  invariant applies (see getSessionsSince): no `completed` filter. */
export function getAllSessionEndedAt(): number[] {
  const rows = getDb().getAllSync<{ ended_at: number }>(
    'SELECT ended_at FROM sessions ORDER BY ended_at ASC',
  );
  return rows.map((r) => r.ended_at);
}

/** Most-recent session's `ended_at`, or null on an empty DB. Powers the M4.7
 *  gap clock (`actualGap = now − lastEndedAt`) inside `computeSessionPlan`.
 *  Same L16 invariant: DONE and saved partials both count; discarded never
 *  wrote a row in the first place. */
export function getLastSessionEndedAt(): number | null {
  const row = getDb().getFirstSync<{ ended_at: number }>(
    'SELECT ended_at FROM sessions ORDER BY ended_at DESC LIMIT 1',
  );
  return row?.ended_at ?? null;
}

/** Every session's focus_score in chronological order (oldest first) — the
 *  input series for the M5.1 EWMA forecast (services/ml/forecast). Lightweight:
 *  no distraction join, just the scalar series. Same L16 invariant as the other
 *  reads here — DONE (`completed=1`) AND saved partials (`completed=0`) both
 *  feed the forecast; discarded sessions never wrote a row, so no filter. */
export function getFocusScoreSeries(): number[] {
  const rows = getDb().getAllSync<{ focus_score: number }>(
    'SELECT focus_score FROM sessions ORDER BY ended_at ASC',
  );
  return rows.map((r) => r.focus_score);
}

/** Highest single-session focus_score in history, or null if there are no
 *  sessions. SQLite returns one row with m=null on an empty table — normalize
 *  to a plain null so callers don't have to unpack the shape. */
export function getMaxFocusScore(): number | null {
  const row = getDb().getFirstSync<{ m: number | null }>(
    'SELECT MAX(focus_score) AS m FROM sessions',
  );
  return row?.m ?? null;
}

/** The single highest-focus_score session in history, or null on an empty DB —
 *  the "best session" item in the S5.1 Personal-best view (richer than the bare
 *  MAX scalar from getMaxFocusScore: carries minutes, when, and the task title,
 *  which is owner-private and shown only on the user's own screen). Ties resolve
 *  to the most recent (ORDER BY ended_at DESC). Reassembles distractions so the
 *  returned shape round-trips like the other reads here. */
export function getBestSession(): CompletedSession | null {
  const rows = getDb().getAllSync<SessionRow>(
    'SELECT * FROM sessions ORDER BY focus_score DESC, ended_at DESC LIMIT 1',
  );
  return rowsToSessions(rows)[0] ?? null;
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

/** Wipe ALL session history + its distractions, in one transaction. Called from
 *  the sign-out teardown (services/firebase/auth.ts), mirroring deleteAllTasks.
 *
 *  Reads in this module have NO uid filter and there is no per-user SQLite
 *  isolation in MVP, so without this the next account would inherit the prior
 *  user's hero score / forecast / streak / best-session (which carries a PRIVATE
 *  task title) and cold-start fatigue. Security-relevant — see bug-audit-w5 #14.
 *  Full per-user isolation (a uid column + filter) is still deferred. */
export function deleteAllSessions(): void {
  const db = getDb();
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM distractions');
    db.runSync('DELETE FROM sessions');
  });
}
