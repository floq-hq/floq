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
// `partnerName` + `dormant` depend on the M7.1 social-summary projection (NOT
// landed): we best-effort read users/{partnerUid}/social/summary and degrade to
// name=null / dormant=false until it ships. See S7.1.

import { doc, getDoc } from 'firebase/firestore';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
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

/** Best-effort partner display name + activity from the M7.1 social summary.
 *  Returns nulls (name) / false (dormant) until that projection lands. */
async function readPartnerSummary(
  partnerUid: string,
): Promise<{ name: string | null; hasFocused: boolean }> {
  try {
    const snap = await getDoc(doc(db, 'users', partnerUid, 'social', 'summary'));
    if (!snap.exists()) return { name: null, hasFocused: false };
    const d = snap.data() as Record<string, unknown>;
    const name =
      typeof d.display_name === 'string'
        ? d.display_name
        : typeof d.name === 'string'
          ? d.name
          : null;
    // M7.1 will write a session count / last-active; treat any positive as "has focused".
    const sessions = typeof d.sessions_count === 'number' ? d.sessions_count : 0;
    return { name, hasFocused: sessions > 0 };
  } catch {
    return { name: null, hasFocused: false };
  }
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
