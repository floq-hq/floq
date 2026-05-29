// Migration 003 — sessions.overrun_minutes (M4.6 / L16).
//
// Records minutes the user focused past the planned (`overrun = max(0, actual −
// planned)`). DEFAULT 0 is correct for backfill — pre-M4.6 sessions didn't
// have the concept and were recorded with a single planned/actual figure.
//
// Append-only. Never edit a shipped migration in place (root CLAUDE.md safety
// rule). The recomputed recovery break itself stays in the existing
// `break_minutes` column (see `services/session/overrun.ts`).

import type { Migration } from './types';

export const MIGRATION_003: Migration = {
  version: 3,
  up: `
    ALTER TABLE sessions ADD COLUMN overrun_minutes INTEGER NOT NULL DEFAULT 0;
  `,
};
