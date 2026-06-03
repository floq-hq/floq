// S7.2 share-consent read/write — the one pairing consent (L28: explicit,
// default-OFF, per-member, symmetric, revocable). My consent bit
// (share_consent[me]) is what lets MY partner read MY summary + presence; my
// partner controls theirs the same way. The write goes through partners.ts
// (setShareConsent → the consent-self-toggle rule branch); this hook only adds
// the read + cache invalidation so the Partner tab reflects the flip at once.
//
// A plain query, NOT a listener — my own bit only changes when I toggle it (no
// one else may write it), so there's nothing to live-subscribe to. (The single
// allowed presence listener stays in PartnerView per mobile/CLAUDE.md.)

import { doc, getDoc } from 'firebase/firestore';
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { db, setShareConsent, useCurrentUser } from '../firebase';

/** My consent bit from a partnership doc's share_consent map. Pure; default-OFF. */
export function readMyConsent(
  shareConsent: Record<string, unknown> | undefined | null,
  uid: string,
): boolean {
  return shareConsent?.[uid] === true;
}

const consentKey = (pairId?: string | null, uid?: string | null) =>
  ['partner', 'consent', pairId, uid] as const;

/** Whether I'm currently sharing my focus activity with my partner. */
export function useShareConsent(pairId: string | null | undefined): UseQueryResult<boolean> {
  const { user } = useCurrentUser();
  const uid = user?.uid;
  return useQuery({
    queryKey: consentKey(pairId, uid),
    enabled: !!pairId && !!uid,
    queryFn: async () => {
      const snap = await getDoc(doc(db, 'partnerships', pairId as string));
      const data = snap.data() as { share_consent?: Record<string, unknown> } | undefined;
      return readMyConsent(data?.share_consent, uid as string);
    },
  });
}

/** Flip my consent, optimistically; settle from the server, invalidate on done. */
export function useSetShareConsent(pairId: string | null | undefined) {
  const { user } = useCurrentUser();
  const uid = user?.uid;
  const qc = useQueryClient();
  const key = consentKey(pairId, uid);
  return useMutation({
    mutationFn: (value: boolean) => setShareConsent(value),
    onMutate: async (value: boolean) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<boolean>(key);
      qc.setQueryData(key, value);
      return { prev };
    },
    onError: (_e, _value, ctx) => {
      if (ctx) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key });
    },
  });
}
