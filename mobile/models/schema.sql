-- Floq on-device SQLite schema (M4.2).
--
-- CANONICAL REFERENCE ONLY. This file documents the current shape of the
-- database; it is NOT executed at runtime. The executable DDL lives in the
-- numbered, append-only migrations under models/migrations/, applied on first
-- DB access (see models/db.ts). SAFETY RULE (root CLAUDE.md): never edit a
-- shipped table in place — add a new migration and update this reference.
--
-- Conventions: booleans are INTEGER 0/1; all timestamps are epoch-ms INTEGER;
-- focus_score is REAL (the M4.1 formula yields fractional and negative values).
-- "order" is quoted everywhere — it is a SQL reserved word.
--
-- Current schema version: 3 (models/migrations/003_session_overrun.ts)

-- The task queue. Source of truth for the queue (MMKV is a fast-read cache).
-- Mirrored async to Firestore users/{uid}/tasks (owner-only).
CREATE TABLE tasks (
  id          TEXT    PRIMARY KEY,
  title       TEXT    NOT NULL,          -- PRIVATE; never synced to social
  difficulty  INTEGER NOT NULL,          -- 1..5
  est_minutes INTEGER NOT NULL,
  "order"     INTEGER NOT NULL,          -- queue position; 0 = visible/top task
  done        INTEGER NOT NULL DEFAULT 0,-- boolean 0/1
  created_at  INTEGER NOT NULL           -- epoch ms
);
CREATE INDEX idx_tasks_order ON tasks("order");

-- Completed sessions (DONE or saved end-early partials). Append-only.
-- Mirrored async to Firestore users/{uid}/sessions/{id}. The task snapshot
-- is flattened into columns. Per L16 + services/stats/aggregations.ts, both
-- `completed=1` (DONE) and `completed=0` (saved partial) count toward stats
-- and streak; DISCARDED sessions never write a row at all.
CREATE TABLE sessions (
  id                    TEXT    PRIMARY KEY,
  task_id               TEXT,                -- may be null if the task was deleted
  task_title            TEXT    NOT NULL,
  task_difficulty       INTEGER NOT NULL,
  task_est_minutes      INTEGER NOT NULL,
  planned_focus_minutes INTEGER NOT NULL,
  actual_focus_minutes  INTEGER NOT NULL,
  break_minutes         INTEGER NOT NULL,    -- M4.6: recomputed from ACTUAL at DONE
  focus_score           REAL    NOT NULL,    -- M4.1; can be negative/fractional
  regime                TEXT    NOT NULL,    -- 'cold' | 'warming' | 'mature'
  client_version        TEXT    NOT NULL,
  model_version         TEXT,                -- only set when regime = 'mature'
  started_at            INTEGER NOT NULL,    -- epoch ms
  ended_at              INTEGER NOT NULL,    -- epoch ms
  completed             INTEGER NOT NULL DEFAULT 1,  -- M4.5: 1=DONE, 0=saved partial
  overrun_minutes       INTEGER NOT NULL DEFAULT 0   -- M4.6: max(0, actual − planned)
);
CREATE INDEX idx_sessions_ended_at ON sessions(ended_at);

-- Per-session distraction timestamps (one row per tap). Cascades on session delete.
CREATE TABLE distractions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  ts         INTEGER NOT NULL                -- epoch ms
);
CREATE INDEX idx_distractions_session ON distractions(session_id);
