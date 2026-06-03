// First-party product analytics (M7.2) — the W8 Axis-A funnel instrument.
//
// logEvent() stages a coarse event locally (analyticsOutbox) and kicks a
// best-effort flush. ALWAYS-ON (no consent gate — gating it default-OFF would
// zero the funnel the whole W7/W8 read depends on). uid-LINKED, create-only,
// NOT wiped — deliberately distinct from the anonymous L23 training_samples.
//
// L4 boundary: `name` is a typed union (no free-text event names) and props is a
// SHALLOW PRIMITIVE map run through sanitizeProps — NO task titles, free text, or
// display names ever reach here. The rule caps the blast radius; the type +
// sanitize are the real guarantee.
//
// React-free.

import { createMMKV } from 'react-native-mmkv';
import { auth } from '../firebase/auth';
import { enqueueEvent, type AnalyticsProps } from '../storage/analyticsOutbox';
import { flushAnalyticsEvents } from './uploadAnalyticsEvents';

/** The closed set of funnel events. Extend as S-lane funnel points land. */
export type AnalyticsEventName =
  | 'invite_created'
  | 'invite_accepted'
  | 'reaction_sent'
  | 'consent_set'
  | 'install'
  | 'start_together'
  | 'skip'
  | 'card_claim';

const storage = createMMKV();
const SEQ_KEY = 'floq.analytics.seq';
const MAX_PROP_STR = 64;

/** Per-device monotonic counter → the `seq` half of the deterministic eventId. */
function nextSeq(): number {
  const n = (storage.getNumber(SEQ_KEY) ?? 0) + 1;
  storage.set(SEQ_KEY, n);
  return n;
}

/** Keep only primitive values; truncate strings. A mistaken caller still can't
 *  ship a nested object / free-text blob. */
export function sanitizeProps(props?: AnalyticsProps): AnalyticsProps {
  if (!props) return {};
  const out: AnalyticsProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === 'number' || typeof v === 'boolean') out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, MAX_PROP_STR);
  }
  return out;
}

/** Stage + best-effort flush a funnel event. No-op when signed out (the create
 *  rule requires `uid == auth.uid`, so an anon event could never upload). */
export function logEvent(name: AnalyticsEventName, props?: AnalyticsProps, kind = ''): void {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const seq = nextSeq();
  enqueueEvent({
    eventId: `${uid}:${seq}`,
    uid,
    name,
    ts: Date.now(),
    seq,
    kind,
    props: sanitizeProps(props),
  });
  void flushAnalyticsEvents().catch(() => {});
}
