// Migration 001 — initial schema (M4.2): tasks, sessions, distractions.
//
// Executable DDL. The human-readable reference is models/schema.sql; keep the
// two in sync. APPEND-ONLY: never edit this once shipped — add 002_*.ts.
// `IF NOT EXISTS` makes re-running harmless on a DB that already has the tables.

import type { Migration } from './types';

export const MIGRATION_001: Migration = {
  version: 1,
  up: `
    CREATE TABLE IF NOT EXISTS tasks (
      id          TEXT    PRIMARY KEY,
      title       TEXT    NOT NULL,
      difficulty  INTEGER NOT NULL,
      est_minutes INTEGER NOT NULL,
      "order"     INTEGER NOT NULL,
      done        INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_order ON tasks("order");

    CREATE TABLE IF NOT EXISTS sessions (
      id                    TEXT    PRIMARY KEY,
      task_id               TEXT,
      task_title            TEXT    NOT NULL,
      task_difficulty       INTEGER NOT NULL,
      task_est_minutes      INTEGER NOT NULL,
      planned_focus_minutes INTEGER NOT NULL,
      actual_focus_minutes  INTEGER NOT NULL,
      break_minutes         INTEGER NOT NULL,
      focus_score           REAL    NOT NULL,
      regime                TEXT    NOT NULL,
      client_version        TEXT    NOT NULL,
      model_version         TEXT,
      started_at            INTEGER NOT NULL,
      ended_at              INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_ended_at ON sessions(ended_at);

    CREATE TABLE IF NOT EXISTS distractions (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT    NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      ts         INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_distractions_session ON distractions(session_id);
  `,
};
