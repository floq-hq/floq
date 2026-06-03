import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('expo-sqlite', () => import('../../../test/expoSqliteFake'));

import { resetExpoSqliteFake } from '../../../test/expoSqliteFake';
import {
  enqueueEvent,
  takeUnuploadedEvents,
  markEventUploaded,
  deleteAllAnalyticsEvents,
  type AnalyticsEventRow,
} from '../analyticsOutbox';

function row(overrides: Partial<AnalyticsEventRow> = {}): AnalyticsEventRow {
  return {
    eventId: 'u1:1',
    uid: 'u1',
    name: 'invite_created',
    ts: 1700000000000,
    seq: 1,
    kind: '',
    props: {},
    ...overrides,
  };
}

beforeEach(() => {
  resetExpoSqliteFake();
});

describe('analyticsOutbox', () => {
  it('O1: enqueue then take round-trips, props_json parses back to the object', () => {
    enqueueEvent(row({ props: { kind: 'fire', already_paired: true, n: 3 } }));
    const out = takeUnuploadedEvents();
    expect(out).toHaveLength(1);
    expect(out[0].eventId).toBe('u1:1');
    expect(out[0].props).toEqual({ kind: 'fire', already_paired: true, n: 3 });
  });

  it('O2: enqueue of the same event_id is idempotent (INSERT OR IGNORE)', () => {
    enqueueEvent(row({ name: 'invite_created' }));
    enqueueEvent(row({ name: 'CHANGED' })); // same event_id u1:1 → ignored
    const out = takeUnuploadedEvents();
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('invite_created');
  });

  it('O3: markEventUploaded removes it from the unuploaded set', () => {
    enqueueEvent(row());
    markEventUploaded('u1:1');
    expect(takeUnuploadedEvents()).toHaveLength(0);
  });

  it('O4: take respects the limit and orders by seq', () => {
    enqueueEvent(row({ eventId: 'u1:2', seq: 2 }));
    enqueueEvent(row({ eventId: 'u1:1', seq: 1 }));
    enqueueEvent(row({ eventId: 'u1:3', seq: 3 }));
    const out = takeUnuploadedEvents(2);
    expect(out.map((e) => e.seq)).toEqual([1, 2]);
  });

  it('O5: deleteAll empties the table', () => {
    enqueueEvent(row());
    deleteAllAnalyticsEvents();
    expect(takeUnuploadedEvents()).toHaveLength(0);
  });
});
