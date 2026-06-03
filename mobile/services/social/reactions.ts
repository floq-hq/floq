// One-tap fire/clap reactions (M7.2).
//
// A reaction is the REACTOR writing into the TARGET's tree at
// users/{ownerUid}/reactions/{reactorUid} (doc id = the reactor, so a re-react
// overwrites — idempotent, one live reaction per direction). The target (owner)
// reads their OWN reactions subcollection to see "your partner reacted". The rule
// gates create/update on partnerCanRead (you can only react to a session you're
// allowed to SEE — consent + active edge); reactor-delete is ungated so a reactor
// can always clean up (wipe / unpair).
//
// React-free except the thin read hook. Best-effort.

import { useEffect, useState } from 'react';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase/init';
import { auth, useCurrentUser } from '../firebase';
import { logEvent } from '../analytics/logEvent';

export type ReactionKind = 'fire' | 'clap';

export interface ReceivedReaction {
  reactorUid: string; // = doc id
  kind: ReactionKind;
  reactedAt: number; // epoch ms
  sessionEndedAt: number; // epoch ms — anchors to a specific finished session
}

function reactionRef(ownerUid: string, reactorUid: string) {
  return doc(db, 'users', ownerUid, 'reactions', reactorUid);
}

function toMs(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

/**
 * React to a partner's finished session. Writes into the partner's tree (the
 * cross-tree reactor grant). `reacted_at` MUST be serverTimestamp() — the rule
 * asserts it equals request.time. `sessionEndedAtMs` is the summary `ended_at`
 * the reactor just saw, so the reaction anchors to that specific session.
 */
export async function sendReaction(
  partnerUid: string,
  kind: ReactionKind,
  sessionEndedAtMs: number,
): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) return;
  await setDoc(reactionRef(partnerUid, me), {
    kind,
    reacted_at: serverTimestamp(),
    session_ended_at: Timestamp.fromMillis(sessionEndedAtMs),
  });
  logEvent('reaction_sent', { kind });
}

/** Remove my reaction from the partner's tree (ungated reactor-delete). */
export async function removeReaction(partnerUid: string): Promise<void> {
  const me = auth.currentUser?.uid;
  if (!me) return;
  await deleteDoc(reactionRef(partnerUid, me));
}

function toReceived(reactorUid: string, d: Record<string, unknown>): ReceivedReaction {
  return {
    reactorUid,
    kind: d.kind === 'clap' ? 'clap' : 'fire',
    reactedAt: toMs(d.reacted_at),
    sessionEndedAt: toMs(d.session_ended_at),
  };
}

/** Live subscription to the reactions I RECEIVED (my own subcollection). */
export function subscribeReceivedReactions(
  uid: string,
  onChange: (reactions: ReceivedReaction[]) => void,
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'reactions'),
    (snap) => onChange(snap.docs.map((d) => toReceived(d.id, d.data()))),
    (error) => {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn('[reactions] received-reactions listener error', error);
      }
    },
  );
}

/** Thin hook over subscribeReceivedReactions (Partner tab only). */
export function useReceivedReactions(): ReceivedReaction[] {
  const { user } = useCurrentUser();
  const uid = user?.uid;
  const [reactions, setReactions] = useState<ReceivedReaction[]>([]);

  useEffect(() => {
    if (!uid) {
      setReactions([]);
      return;
    }
    return subscribeReceivedReactions(uid, setReactions);
  }, [uid]);

  return reactions;
}
