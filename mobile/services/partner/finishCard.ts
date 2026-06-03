// S7.3 "what your partner did" — the in-app finish card surfaced on next Home
// open (no remote push this week). It's an async social nudge: when the partner
// finished a session you haven't seen yet, Home shows a calm card once. A local
// "seen" marker (the last ended_at we acknowledged) gates it so it shows once
// per finished session, never nags. Reads are one-shot (no Home listener — the
// single live presence listener stays Partner-tab-only, mobile/CLAUDE.md).

import { useCallback } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { useFocusEffect } from 'expo-router';
import { createMMKV } from 'react-native-mmkv';
import { useQuery } from '@tanstack/react-query';
import { db, useCurrentUser } from '../firebase';
import { isMuted } from './mutePartner';

export interface FinishCard {
  name: string;
  minutes: number;
  focusScore: number;
  phaseAtEnd: string;
  endedAt: number; // epoch ms — the session this card is about
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

/** Pure: a card iff the partner's latest finished session is newer than what
 *  we've already acknowledged. Null when there's no summary or it's stale/seen. */
export function finishCardFor(
  summary: { minutes: number; focusScore: number; phaseAtEnd: string; endedAt: number } | null,
  name: string,
  lastSeenMs: number,
): FinishCard | null {
  if (!summary || !(summary.endedAt > 0) || summary.endedAt <= lastSeenMs) return null;
  return {
    name,
    minutes: summary.minutes,
    focusScore: summary.focusScore,
    phaseAtEnd: summary.phaseAtEnd,
    endedAt: summary.endedAt,
  };
}

const storage = createMMKV();
const SEEN_KEY = 'floq.partner.finishSeenAt';
function getSeen(): number {
  return storage.getNumber(SEEN_KEY) ?? 0;
}
function markSeen(endedAt: number): void {
  storage.set(SEEN_KEY, endedAt);
}

const finishCardKey = (uid?: string) => ['partner', 'finishCard', uid] as const;

/**
 * Home finish card. One-shot reads (pointer → profile + summary), refetched each
 * time Home regains focus. Returns the card to show (or null) + a dismiss that
 * marks it seen so it won't reappear for that session. Muted / solo → null.
 */
export function usePartnerFinishCard(): { card: FinishCard | null; dismiss: () => void } {
  const { user } = useCurrentUser();
  const uid = user?.uid;

  const { data, refetch } = useQuery({
    queryKey: finishCardKey(uid),
    enabled: !!uid,
    queryFn: async (): Promise<FinishCard | null> => {
      const ptr = await getDoc(doc(db, 'users', uid as string, 'partner', 'current'));
      if (!ptr.exists()) return null;
      const { pair_id, partner_uid } = ptr.data() as { pair_id: string; partner_uid: string };
      if (isMuted(pair_id)) return null;

      const [profileSnap, summarySnap] = await Promise.all([
        getDoc(doc(db, 'users', partner_uid, 'social', 'profile')).catch(() => null),
        getDoc(doc(db, 'users', partner_uid, 'social', 'summary')).catch(() => null),
      ]);
      if (!summarySnap || !summarySnap.exists()) return null;

      const name =
        (profileSnap?.data() as { display_name?: string } | undefined)?.display_name ?? 'Your partner';
      const s = summarySnap.data() as RawSummary;
      return finishCardFor(
        {
          minutes: s.minutes ?? 0,
          focusScore: s.focus_score ?? 0,
          phaseAtEnd: s.phase_at_end ?? 'flow',
          endedAt: toMs(s.ended_at),
        },
        name,
        getSeen(),
      );
    },
  });

  // "On next Home open" — refetch whenever Home regains focus.
  useFocusEffect(
    useCallback(() => {
      if (uid) void refetch();
    }, [uid, refetch]),
  );

  const dismiss = useCallback(() => {
    if (data) markSeen(data.endedAt);
    void refetch();
  }, [data, refetch]);

  return { card: data ?? null, dismiss };
}
