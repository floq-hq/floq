// Migration 002 — sessions.completed (M4.5 / L16).
//
// Distinguishes DONE sessions from end-early "save progress" partials. DEFAULT
// 1 backfills every existing shipped row to "DONE" — that's correct because
// DONE was the only possible end path before M4.5 (no abandon, no restore-save).
//
// Append-only. Never edit 001 in place (root CLAUDE.md safety rule). Per L16
// and `services/stats/aggregations.ts`'s header, BOTH `completed=1` and
// `completed=0` count toward stats/streak — only DISCARDED sessions never
// write a row, so the aggregation queries stay correct without a filter.

import type { Migration } from './types';

export const MIGRATION_002: Migration = {
  version: 2,
  up: `
    ALTER TABLE sessions ADD COLUMN completed INTEGER NOT NULL DEFAULT 1;
  `,
};
