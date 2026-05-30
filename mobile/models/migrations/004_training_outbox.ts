// Migration 004 — training_outbox (L23).
//
// On-device staging table for anonymized ML training samples. Capture is
// L2-clean: a row is written here at session save and NEVER leaves the device
// until the user opts in (telemetryConsent) and the egress flush ships (a later
// PR reads `uploaded=0` settled rows and uploads them). Kept SEPARATE from the
// `sessions` table so telemetry state (task_completed / uploaded) doesn't
// pollute the core session record.
//
// `task_completed` is resolved LATER than the row is written — it's the L19
// recovery-screen Mark-task-done signal, which happens after the session saves.
// Defaults 0; setTaskCompleted() flips it. `features` is a JSON number[13]
// (ml/MODEL_SPEC.md); contains NO task title / uid / free text (L4).
//
// Append-only. Never edit a shipped migration in place (root CLAUDE.md safety).

import type { Migration } from './types';

export const MIGRATION_004: Migration = {
  version: 4,
  up: `
    CREATE TABLE IF NOT EXISTS training_outbox (
      session_id            TEXT PRIMARY KEY,
      features              TEXT    NOT NULL,
      focus_score           REAL    NOT NULL,
      actual_focus_minutes  INTEGER NOT NULL,
      planned_focus_minutes INTEGER NOT NULL,
      regime                TEXT    NOT NULL,
      model_version         TEXT    NOT NULL,
      task_completed        INTEGER NOT NULL DEFAULT 0,
      created_at            INTEGER NOT NULL,
      uploaded              INTEGER NOT NULL DEFAULT 0
    );
  `,
};
