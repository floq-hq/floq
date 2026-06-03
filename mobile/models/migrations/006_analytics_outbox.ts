// Migration 006 — analytics_outbox (M7.2).
//
// On-device staging for first-party product-funnel events (the W8 Axis-A
// instrument). A row is enqueued by logEvent() and best-effort flushed to the
// top-level `analytics_events` collection. ALWAYS-ON (no consent gate — unlike
// training_outbox): without the funnel there is no W8 read.
//
// The deterministic event_id (`${uid}:${seq}`) is the idempotency key: a re-send
// of an already-uploaded event hits the create-only rule as an update → denied →
// recorded exactly once. NO task titles / display names / free text land here
// (L4) — `props_json` is a shallow primitive map, client-disciplined + size-
// capped at the rules boundary.
//
// Append-only. Never edit a shipped migration in place (root CLAUDE.md safety).

import type { Migration } from './types';

export const MIGRATION_006: Migration = {
  version: 6,
  up: `
    CREATE TABLE IF NOT EXISTS analytics_outbox (
      event_id    TEXT PRIMARY KEY,
      uid         TEXT    NOT NULL,
      name        TEXT    NOT NULL,
      ts          INTEGER NOT NULL,
      seq         INTEGER NOT NULL,
      kind        TEXT    NOT NULL DEFAULT '',
      props_json  TEXT    NOT NULL DEFAULT '{}',
      uploaded    INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_analytics_unuploaded
      ON analytics_outbox (uploaded, seq);
  `,
};
