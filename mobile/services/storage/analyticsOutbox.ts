// Analytics outbox (M7.2) — SQLite staging for first-party funnel events
// (migration 006). logEvent() enqueues here; a best-effort flush
// (analytics/uploadAnalyticsEvents) ships rows to the top-level `analytics_events`
// collection. ALWAYS-ON (no consent gate). NO task titles / display names / free
// text (L4) — `props` is a shallow primitive map.
//
// The event_id (`${uid}:${seq}`) is the idempotency key; re-enqueue of the same
// id is a no-op (INSERT OR IGNORE). Synchronous (expo-sqlite sync API); no React.

import { getDb } from '../../models/db';

export type AnalyticsProps = Record<string, string | number | boolean>;

export interface AnalyticsEventRow {
  eventId: string;
  uid: string;
  name: string;
  ts: number; // capture-time epoch ms (offline-truthful — NOT a server clock)
  seq: number;
  kind: string;
  props: AnalyticsProps;
}

interface OutboxRow {
  event_id: string;
  uid: string;
  name: string;
  ts: number;
  seq: number;
  kind: string;
  props_json: string;
}

/** Stage an event. Idempotent on event_id (INSERT OR IGNORE) — a re-enqueue of an
 *  already-staged deterministic id must not disturb the existing row. */
export function enqueueEvent(e: AnalyticsEventRow): void {
  getDb().runSync(
    `INSERT OR IGNORE INTO analytics_outbox
       (event_id, uid, name, ts, seq, kind, props_json, uploaded)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    e.eventId,
    e.uid,
    e.name,
    e.ts,
    e.seq,
    e.kind,
    JSON.stringify(e.props),
  );
}

/** Un-uploaded events, oldest first (the `(uploaded, seq)` index keeps this cheap). */
export function takeUnuploadedEvents(limit = 200): AnalyticsEventRow[] {
  const rows = getDb().getAllSync<OutboxRow>(
    `SELECT event_id, uid, name, ts, seq, kind, props_json
       FROM analytics_outbox
      WHERE uploaded = 0
      ORDER BY seq ASC
      LIMIT ?`,
    limit,
  );
  return rows.map((r) => ({
    eventId: r.event_id,
    uid: r.uid,
    name: r.name,
    ts: r.ts,
    seq: r.seq,
    kind: r.kind,
    props: safeParse(r.props_json),
  }));
}

function safeParse(json: string): AnalyticsProps {
  try {
    const v = JSON.parse(json) as unknown;
    return v && typeof v === 'object' ? (v as AnalyticsProps) : {};
  } catch {
    return {};
  }
}

/** Mark an event uploaded so the flush never re-sends it. */
export function markEventUploaded(eventId: string): void {
  getDb().runSync('UPDATE analytics_outbox SET uploaded = 1 WHERE event_id = ?', eventId);
}

/** Wipe the outbox — part of the sign-out teardown (mirrors deleteAllTrainingSamples). */
export function deleteAllAnalyticsEvents(): void {
  getDb().runSync('DELETE FROM analytics_outbox');
}
