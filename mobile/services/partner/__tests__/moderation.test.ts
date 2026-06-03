import { describe, it, expect, vi } from 'vitest';

// Mock the native/side-effecting boundaries so the pure helpers import in node.
vi.mock('react-native-mmkv', () => ({ createMMKV: () => ({ getString: () => undefined, getNumber: () => undefined, set: () => {}, remove: () => {} }) }));
vi.mock('expo-router', () => ({ useFocusEffect: () => {} }));
vi.mock('../../firebase', () => ({ db: {}, useCurrentUser: () => ({ user: null }) }));

import { isMutedPair } from '../mutePartner';
import { finishCardFor } from '../finishCard';

describe('isMutedPair', () => {
  it('true only for the exact stored pair (default-OFF otherwise)', () => {
    expect(isMutedPair('pair_ab', 'pair_ab')).toBe(true);
    expect(isMutedPair('pair_ab', 'pair_cd')).toBe(false); // re-paired with someone else
    expect(isMutedPair(null, 'pair_ab')).toBe(false);
    expect(isMutedPair('pair_ab', null)).toBe(false);
    expect(isMutedPair('pair_ab', undefined)).toBe(false);
  });
});

describe('finishCardFor', () => {
  const summary = { minutes: 25, focusScore: 80, phaseAtEnd: 'flow', endedAt: 2000 };

  it('shows a card when the session is newer than what we last saw', () => {
    const c = finishCardFor(summary, 'Sara', 1000);
    expect(c).toMatchObject({ name: 'Sara', minutes: 25, focusScore: 80, endedAt: 2000 });
  });

  it('null when already seen (equal or older ended_at) — shows once, never nags', () => {
    expect(finishCardFor(summary, 'Sara', 2000)).toBeNull();
    expect(finishCardFor(summary, 'Sara', 3000)).toBeNull();
  });

  it('null when there is no summary or no real end time', () => {
    expect(finishCardFor(null, 'Sara', 0)).toBeNull();
    expect(finishCardFor({ ...summary, endedAt: 0 }, 'Sara', 0)).toBeNull();
  });
});
