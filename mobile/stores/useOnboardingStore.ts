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
  clearDraft,
  clearOnboarding,
  healOnboardingMirror,
  loadDraft,
  loadOnboardingResolved,
  saveDraft,
  saveOnboarding,
  type OnboardingAnswers,
  type OnboardingLoad,
} from '../services/onboarding';

interface OnboardingState {
  /** Complete, persisted answers (null until onboarding is finalized/loaded). */
  answers: OnboardingAnswers | null;
  /** In-progress per-question edits during the onboarding flow (S2.1 UI). */
  draft: Partial<OnboardingAnswers>;
  /** True once hydrate() has run (so the UI can avoid a flash before load). */
  hydrated: boolean;
  /**
   * True only when a RETURNING account's onboarding state couldn't be confirmed
   * (Firestore unreachable, empty MMKV). The boot gate (app/index.tsx) routes
   * such a user to Home rather than re-prompting Q1 — the mirror self-heals on a
   * later boot. Never set for a brand-new account (those still reach onboarding).
   */
  onboardingUnresolved: boolean;

  setAnswer: <K extends keyof OnboardingAnswers>(
    key: K,
    value: OnboardingAnswers[K],
  ) => void;
  hydrate: (uid?: string, opts?: { isBrandNew?: boolean }) => Promise<void>;
  finalize: (uid?: string) => Promise<void>;
  reset: () => void;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  answers: null,
  draft: {},
  hydrated: false,
  onboardingUnresolved: false,

  setAnswer: (key, value) =>
    set((s) => {
      const draft = { ...s.draft, [key]: value } as Partial<OnboardingAnswers>;
      saveDraft(draft); // persist immediately so a kill mid-flow resumes here (S2.1)
      return { draft };
    }),

  hydrate: async (uid, opts) => {
    let result: OnboardingLoad;
    try {
      result = await loadOnboardingResolved(uid);
    } catch {
      // loadOnboardingResolved swallows its own I/O errors, but stay defensive.
      result = { status: 'unknown' };
    }

    if (result.status === 'found') {
      // Restore nothing — a finalized user routes to Home and never re-enters the
      // question flow. Repair a dropped server mirror in the background (never
      // blocks the gate) so the next re-login reads `found` instead of re-prompting.
      set({ answers: result.answers, draft: {}, hydrated: true, onboardingUnresolved: false });
      void healOnboardingMirror(uid, result.answers);
      return;
    }

    if (result.status === 'absent' || opts?.isBrandNew) {
      // Server-CONFIRMED no onboarding, OR a brand-new account that couldn't reach
      // the server (offline new install): into the onboarding flow, restoring any
      // in-progress draft so a kill mid-flow resumes where it left off.
      set({ answers: null, draft: loadDraft(), hydrated: true, onboardingUnresolved: false });
      return;
    }

    // status === 'unknown' on a RETURNING account: the read failed and we must NOT
    // mistake that for a new user. Release the gate (never strand the splash) but
    // flag it unresolved so app/index.tsx routes to Home, not Q1. The mirror
    // self-heals on the next successful boot.
    set({ answers: null, draft: {}, hydrated: true, onboardingUnresolved: true });
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
    clearDraft(); // complete blob is the source of truth now; drop the draft
    set({ answers, draft: {} });
  },

  reset: () => {
    clearOnboarding();
    set({ answers: null, draft: {}, hydrated: false, onboardingUnresolved: false });
  },
}));
