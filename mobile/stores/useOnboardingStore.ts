// Onboarding store (M2.2) — the first Zustand store; sets the house pattern.
//
// Convention: NO zustand `persist` middleware. MMKV is our synchronous
// source of truth and persistence is explicit via services/onboarding/persist.
// The middleware's async-rehydrate model fights MMKV's sync reads, so stores
// stay plain and call the persistence service directly. One store per concern.
//
// This store is the React facade; services/onboarding/persist.ts is the I/O
// engine. The store imports persist — never the reverse.

import { create } from 'zustand';
import {
  clearOnboarding,
  loadOnboarding,
  saveOnboarding,
  type OnboardingAnswers,
} from '../services/onboarding';

interface OnboardingState {
  /** Complete, persisted answers (null until onboarding is finalized/loaded). */
  answers: OnboardingAnswers | null;
  /** In-progress per-question edits during the onboarding flow (S2.1 UI). */
  draft: Partial<OnboardingAnswers>;
  /** True once hydrate() has run (so the UI can avoid a flash before load). */
  hydrated: boolean;

  setAnswer: <K extends keyof OnboardingAnswers>(
    key: K,
    value: OnboardingAnswers[K],
  ) => void;
  hydrate: (uid?: string) => Promise<void>;
  finalize: (uid?: string) => Promise<void>;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  answers: null,
  draft: {},
  hydrated: false,

  setAnswer: (key, value) =>
    set((s) => ({
      draft: { ...s.draft, [key]: value } as Partial<OnboardingAnswers>,
    })),

  hydrate: async (uid) => {
    const answers = await loadOnboarding(uid);
    set({ answers, hydrated: true });
  },

  finalize: async (uid) => {
    const { base_focus, distraction_level, preferred_time, use_case } = get().draft;
    if (
      base_focus === undefined ||
      distraction_level === undefined ||
      preferred_time === undefined ||
      use_case === undefined
    ) {
      throw new Error('Cannot finalize onboarding: all of Q1–Q4 must be answered.');
    }
    const answers: OnboardingAnswers = {
      base_focus,
      distraction_level,
      preferred_time,
      use_case,
      completed_at: Date.now(),
    };
    await saveOnboarding(answers, uid);
    set({ answers, draft: {} });
  },

  reset: () => {
    clearOnboarding();
    set({ answers: null, draft: {}, hydrated: false });
  },
}));
