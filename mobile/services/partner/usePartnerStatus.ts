// S7.0 partner-state read — the spine of the Partner tab's state machine.
//
// FRONTEND-LANE read (per the S7.0 hand-off): partners.ts (Mohamed) exposes the
// mutations + a private readMyPointer; it does NOT export a status read. Rather
// than edit his file, this reads the owner-readable docs directly via TanStack
// Query, mirroring the userProfile.ts pattern. If/when Mohamed adds a canonical
// getMyPartner() + live listener, this collapses onto it.
//
// Resolves to one of three standing states (after an unpair BOTH pointers are
// deleted, so an ex-partner reads as `solo` — the `ended` case is an accept-time
// claim state, not a standing one):
//   solo         — no pointer, no live invite I minted
//   pendingSent  — I minted an invite that's still pending (waiting on a friend)
//   paired       — my pointer exists + the partnership is active
//
// `partnerName` comes from the M7.1 name projection at users/{partnerUid}/
// social/profile; `dormant` is "no users/{partnerUid}/social/summary yet" (the
// partner has never finished a session). Both reads are best-effort — a consent
// or rule denial degrades to name=null / dormant=true rather than throwing. The
// live partner *view* (presence + summary + reactions) is PartnerView (S7.1);
// this read only powers the tab's solo/pending/paired state machine + identity.

import { useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { db, useCurrentUser } from '../firebase';
import { getMyInviteCode, clearMyInviteCode } from './localInvite';

export type PartnerStatus =
  | { state: 'solo' }
  | { state: 'pendingSent'; code: string }
  | {
      state: 'paired';
      pairId: string;
      partnerUid: string;
      since: number | null;
      partnerName: string | null;
      dormant: boolean;
    };

function toMillis(v: unknown): number | null {
  if (v && typeof (v as { toMillis?: unknown }).toMillis === 'function') {
    return (v as { toMillis: () => number }).toMillis();
  }
  return typeof v === 'number' ? v : null;
}

/** Best-effort partner identity + activity from the M7.1 projections.
 *  Name lives in social/profile (isPartner-gated, no consent needed); activity
 *  is the existence of social/summary (consent-gated — written on first finish).
 *  Either denial/miss degrades to name=null / hasFocused=false. */
async function readPartnerSummary(
  partnerUid: string,
): Promise<{ name: string | null; hasFocused: boolean }> {
  const [name, hasFocused] = await Promise.all([
    getDoc(doc(db, 'users', partnerUid, 'social', 'profile'))
      .then((snap) => {
        const dn = (snap.data() as { display_name?: unknown } | undefined)?.display_name;
        return typeof dn === 'string' ? dn : null;
      })
      .catch(() => null),
    getDoc(doc(db, 'users', partnerUid, 'social', 'summary'))
      .then((snap) => snap.exists())
      .catch(() => false),
  ]);
  return { name, hasFocused };
}

export async function getPartnerStatus(uid: string): Promise<PartnerStatus> {
  // 1) Am I paired? (owner-readable pointer)
  const ptrSnap = await getDoc(doc(db, 'users', uid, 'partner', 'current'));
  if (ptrSnap.exists()) {
    const p = ptrSnap.data() as { pair_id: string; partner_uid: string; since?: unknown };
    const summary = await readPartnerSummary(p.partner_uid);
    return {
      state: 'paired',
      pairId: p.pair_id,
      partnerUid: p.partner_uid,
      since: toMillis(p.since),
      partnerName: summary.name,
      dormant: !summary.hasFocused, // best-effort until M7.1
    };
  }

  // 2) Not paired — did I mint an invite that's still pending?
  const code = getMyInviteCode();
  if (code) {
    const invSnap = await getDoc(doc(db, 'partner_invites', code));
    if (invSnap.exists()) {
      const inv = invSnap.data() as { status?: string; expires_at?: unknown };
      const expired =
        inv.status === 'expired' ||
        ((toMillis(inv.expires_at) ?? 0) > 0 && (toMillis(inv.expires_at) as number) <= Date.now());
      if (inv.status === 'pending' && !expired) {
        return { state: 'pendingSent', code };
      }
    }
    // accepted / revoked / expired / missing → no longer a live pending invite.
    clearMyInviteCode();
  }

  return { state: 'solo' };
}

/** The current user's partner state, via TanStack Query (key namespaced under
 *  ['partner']). Invalidate ['partner'] after createInvite / acceptInvite /
 *  revoke / remove so the tab reflects the change immediately. */
export function usePartnerStatus(): UseQueryResult<PartnerStatus> {
  const { user } = useCurrentUser();
  const uid = user?.uid;
  const qc = useQueryClient();

  // Live tab state, cross-device. The OWN partner pointer (owner-readable) is
  // CREATED when I get paired — including the cross-tree write an accepter makes,
  // which is how an inviter waiting on `pendingSent` flips to `paired` — and
  // DELETED when my partner unpairs/blocks me. onSnapshot it and invalidate the
  // status query so the tab flips solo↔paired in real time without an app restart.
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, 'users', uid, 'partner', 'current'),
      () => void qc.invalidateQueries({ queryKey: ['partner', 'status', uid] }),
      (error) => {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.warn('[partner] pointer listener error', error);
        }
      },
    );
  }, [uid, qc]);

  return useQuery({
    queryKey: ['partner', 'status', uid],
    queryFn: () => getPartnerStatus(uid as string),
    enabled: !!uid,
  });
}

export const partnerKeys = {
  all: ['partner'] as const,
  status: (uid?: string) => ['partner', 'status', uid] as const,
};
