// Partner-visible reads (M7.1) — the thin hooks S7.1/S7.2 consume. All gated on a
// partnerUid (so they don't fire while solo) and keyed by it (no stale cross-pair
// read). usePartnerPresence is the ONE allowed onSnapshot listener — Partner tab
// only, never the session screen (mobile/CLAUDE.md). The actual rule gating
// (consent for summary/presence; isPartner for profile) lives in firestore.rules.

import { useEffect, useState } from 'react';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { doc, getDoc } from 'firebase/firestore';
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

export interface PartnerSummary {
  minutes: number;
  focusScore: number;
  endedAt: number; // epoch ms
  phaseAtEnd: string;
}

interface RawSummary {
  minutes?: number;
  focus_score?: number;
  ended_at?: { toMillis?: () => number } | number;
  phase_at_end?: string;
}

function toMs(v: RawSummary['ended_at']): number {
  if (typeof v === 'number') return v;
  if (v && typeof v.toMillis === 'function') return v.toMillis();
  return 0;
}

/** The partner's last-session summary (consent-gated by the rules). */
export function usePartnerSummary(
  partnerUid: string | null | undefined,
): UseQueryResult<PartnerSummary | null> {
  return useQuery({
    queryKey: ['partner', 'summary', partnerUid],
    enabled: !!partnerUid,
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'users', partnerUid as string, 'social', 'summary'));
      if (!snap.exists()) return null;
      const d = snap.data() as RawSummary;
      return {
        minutes: d.minutes ?? 0,
        focusScore: d.focus_score ?? 0,
        endedAt: toMs(d.ended_at),
        phaseAtEnd: d.phase_at_end ?? 'flow',
      };
    },
  });
}

/** The partner's sanitized display name (isPartner-gated; no consent needed). */
export function usePartnerProfile(
  partnerUid: string | null | undefined,
): UseQueryResult<{ displayName: string } | null> {
  return useQuery({
    queryKey: ['partner', 'profile', partnerUid],
    enabled: !!partnerUid,
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'users', partnerUid as string, 'social', 'profile'));
      if (!snap.exists()) return null;
      const d = snap.data() as { display_name?: string };
      return { displayName: d.display_name ?? 'Floq user' };
    },
  });
}
