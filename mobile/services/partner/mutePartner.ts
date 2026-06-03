// S7.3 mute — reversible, device-local, silent. Muting tears down the live
// partner surface (presence listener + summary read) and suppresses the Home
// finish card, WITHOUT ending the partnership (that's remove/block). Keyed by
// pairId so a fresh pairing is never inadvertently muted, and a re-pair with a
// different person reads as unmuted. React-free except the thin hook.

import { useCallback, useState } from 'react';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV();
const MUTED_PAIR_KEY = 'floq.partner.mutedPair';

/** Pure: is THIS pair the muted one? Default-OFF (no pair muted). */
export function isMutedPair(mutedPairId: string | null, pairId: string | null | undefined): boolean {
  return !!pairId && mutedPairId === pairId;
}

export function getMutedPair(): string | null {
  return storage.getString(MUTED_PAIR_KEY) ?? null;
}

/** Is the given pair currently muted (reads the stored marker)? */
export function isMuted(pairId: string | null | undefined): boolean {
  return isMutedPair(getMutedPair(), pairId);
}

function writeMutedPair(pairId: string | null): void {
  if (pairId) storage.set(MUTED_PAIR_KEY, pairId);
  else storage.remove(MUTED_PAIR_KEY);
}

/** Mute state for one pair + a setter. Local + immediate; reversible. */
export function useMutePartner(pairId: string) {
  const [muted, setLocal] = useState(() => isMuted(pairId));
  const setMuted = useCallback(
    (next: boolean) => {
      writeMutedPair(next ? pairId : null);
      setLocal(next);
    },
    [pairId],
  );
  return { muted, setMuted };
}
