// Migration 005 — training_outbox.consented (L23 no-backfill enforcement).
//
// Records whether telemetry consent was ON when the sample was CAPTURED. The
// egress flush uploads only consented=1 rows, so flipping consent on never
// backfills sessions completed while it was off (L23 invariant) — important now
// that consent syncs account-wide (a second device must not egress its own
// pre-consent outbox). Existing rows default to 0 (treated as not-consented →
// never egress), the conservative/private choice.
//
// Append-only. Never edit a shipped migration in place (root CLAUDE.md safety).

import type { Migration } from './types';

export const MIGRATION_005: Migration = {
  version: 5,
  up: `
    ALTER TABLE training_outbox ADD COLUMN consented INTEGER NOT NULL DEFAULT 0;
  `,
};
