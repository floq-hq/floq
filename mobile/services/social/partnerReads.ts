// Partner-visible reads (M7.1) — the thin hooks S7.1/S7.2 consume. All gated on a
// partnerUid (so they don't fire while solo) and keyed by it (no stale cross-pair
// read). These are LIVE onSnapshot listeners (Partner tab only, never the session
// screen — mobile/CLAUDE.md), so the partner's finished session / name update on
// screen the instant they change, with no app restart. The actual rule gating
// (consent for summary/presence; isPartner for profile) lives in firestore.rules;
// a denied read surfaces as the empty/dormant state, never an error.

import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/init';
import { subscribePresence } from '../presence/presence';
import {
  derivePresence,
  type DerivedPresence,
  type PresenceDoc,
} from '../presence/derivePresence';

// Re-derive on a timer so a stale `focusing` (partner crashed mid-session) decays
// to `idle` on screen without waiting for a new snapshot.
const PRESENCE_REFRESH_MS = 30_000;

/** Live, freshness-clamped presence of the partner. `{state:'idle'}` when solo. */
export function usePartnerPresence(partnerUid: string | null | undefined): DerivedPresence {
  const [raw, setRaw] = useState<PresenceDoc | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!partnerUid) {
      setRaw(null);
      return;
    }
    return subscribePresence(partnerUid, setRaw);
  }, [partnerUid]);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), PRESENCE_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  return derivePresence(raw, Date.now());
}

/** Minimal live-read result (mirrors the `{ data }` shape the partner view binds). */
export interface LiveRead<T> {
  data: T | null;
  loading: boolean;
}

/** Subscribe to a single doc live; map its data (or null when absent / denied). */
function useLiveDoc<T>(
  segments: string[] | null,
  map: (data: Record<string, unknown>) => T,
): LiveRead<T> {
  const [state, setState] = useState<LiveRead<T>>({ data: null, loading: true });
  const key = segments?.join('/') ?? null;

  useEffect(() => {
    if (!segments) {
      setState({ data: null, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    return onSnapshot(
      doc(db, segments[0], ...segments.slice(1)),
      (snap) =>
        setState({ data: snap.exists() ? map(snap.data() as Record<string, unknown>) : null, loading: false }),
      (error) => {
        // consent-denied / offline → dormant, not an error surface.
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[partner] live-doc listener error', error);
        }
        setState({ data: null, loading: false });
      },
    );
    // re-subscribe only when the target path changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state;
}

export interface PartnerSummary {
  minutes: number;
  focusScore: number;
  endedAt: number; // epoch ms
  phaseAtEnd: string;
}

function toMs(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v && typeof (v as { toMillis?: unknown }).toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  return 0;
}

/** The partner's last-session summary, LIVE (consent-gated by the rules). */
export function usePartnerSummary(partnerUid: string | null | undefined): LiveRead<PartnerSummary> {
  return useLiveDoc(
    partnerUid ? ['users', partnerUid, 'social', 'summary'] : null,
    (d) => ({
      minutes: typeof d.minutes === 'number' ? d.minutes : 0,
      focusScore: typeof d.focus_score === 'number' ? d.focus_score : 0,
      endedAt: toMs(d.ended_at),
      phaseAtEnd: typeof d.phase_at_end === 'string' ? d.phase_at_end : 'flow',
    }),
  );
}

/** The partner's sanitized display name, LIVE (isPartner-gated; no consent needed). */
export function usePartnerProfile(
  partnerUid: string | null | undefined,
): LiveRead<{ displayName: string }> {
  return useLiveDoc(
    partnerUid ? ['users', partnerUid, 'social', 'profile'] : null,
    (d) => ({ displayName: typeof d.display_name === 'string' ? d.display_name : 'Floq user' }),
  );
}
