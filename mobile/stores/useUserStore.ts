// User store — client-state facade for the signed-in user's derived stats.
//
// FRONTEND SKELETON (S2.2): exposes only the read surface the UI needs today —
// `currentStreak`. The WRITE side (computing the streak from session history) is
// Mohamed's and lands in W4; this store is the seam the Home streak widget reads
// from now so it doesn't block on that. Mirrors the house pattern: plain Zustand,
// no persist middleware (see useOnboardingStore).

import { create } from 'zustand';

interface UserState {
  /** Consecutive-day focus streak. Stays 0 until W4 wires session-derived updates. */
  currentStreak: number;
  /** Minimal write seam for W4 / tests; Mohamed extends this when streak logic lands. */
  setCurrentStreak: (streak: number) => void;
}

export const useUserStore = create<UserState>((set) => ({
  currentStreak: 0,
  setCurrentStreak: (currentStreak) => set({ currentStreak }),
}));
