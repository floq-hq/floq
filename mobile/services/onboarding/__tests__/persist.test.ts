import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OnboardingAnswers } from '../types';

// --- Mocks: every native / SDK boundary is replaced so this runs in plain node.
// Shared refs are created via vi.hoisted so the (hoisted) vi.mock factories can
// close over them.
const { mmkvStore, setDoc, getDoc } = vi.hoisted(() => ({
  mmkvStore: new Map<string, string>(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
}));

vi.mock('react-native-mmkv', () => ({
  createMMKV: () => ({
    getString: (k: string) => mmkvStore.get(k),
    set: (k: string, v: string) => {
      mmkvStore.set(k, v);
    },
    remove: (k: string) => {
      mmkvStore.delete(k);
    },
  }),
}));

// init.ts throws at import if EXPO_PUBLIC_FIREBASE_* env vars are missing — mock it.
vi.mock('../../firebase/init', () => ({ db: {} }));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
  setDoc: (...args: unknown[]) => setDoc(...args),
  getDoc: (...args: unknown[]) => getDoc(...args),
  serverTimestamp: () => ({ __serverTimestamp: true }),
}));

import {
  ONBOARDING_KEY,
  ONBOARDING_DRAFT_KEY,
  saveOnboarding,
  loadOnboarding,
  clearOnboarding,
  saveDraft,
  loadDraft,
  clearDraft,
} from '../persist';

function sample(overrides: Partial<OnboardingAnswers> = {}): OnboardingAnswers {
  return {
    base_focus: 45,
    distraction_level: 'neutral',
    preferred_time: 'morning',
    use_case: 'work',
    completed_at: 1000,
    ...overrides,
  };
}

beforeEach(() => {
  mmkvStore.clear();
  setDoc.mockReset();
  getDoc.mockReset();
});

describe('saveOnboarding', () => {
  it('AC1: writes one JSON blob to MMKV under floq.onboarding', async () => {
    const answers = sample();
    await saveOnboarding(answers);

    expect([...mmkvStore.keys()]).toEqual([ONBOARDING_KEY]);
    expect(JSON.parse(mmkvStore.get(ONBOARDING_KEY)!)).toEqual(answers);
  });

  it('AC2: merges the onboarding map into users/{uid} with serverTimestamp', async () => {
    await saveOnboarding(sample(), 'u1');

    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, payload, opts] = setDoc.mock.calls[0];
    expect(ref).toEqual({ path: 'users/u1' }); // nested field on users/{uid}, NOT a subdoc
    expect(payload).toEqual({
      onboarding: {
        base_focus: 45,
        distraction_level: 'neutral',
        preferred_time: 'morning',
        use_case: 'work',
        completed_at: { __serverTimestamp: true }, // server clock, not local ms
      },
    });
    expect(opts).toEqual({ merge: true });
  });

  it('AC2-neg: does not touch Firestore when no uid is given', async () => {
    await saveOnboarding(sample());
    expect(setDoc).not.toHaveBeenCalled();
    expect(mmkvStore.has(ONBOARDING_KEY)).toBe(true); // MMKV still written
  });
});

describe('loadOnboarding', () => {
  it('AC3a: reads MMKV first without hitting Firestore', async () => {
    const answers = sample();
    mmkvStore.set(ONBOARDING_KEY, JSON.stringify(answers));

    const result = await loadOnboarding('u1');

    expect(result).toEqual(answers);
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('AC3b: falls back to Firestore on fresh install, converts Timestamp→ms, re-hydrates MMKV', async () => {
    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({
        onboarding: {
          base_focus: 30,
          distraction_level: 'hard',
          preferred_time: 'evening',
          use_case: 'coding',
          completed_at: { toMillis: () => 123456 },
        },
      }),
    });

    const result = await loadOnboarding('u1');

    expect(result).toEqual({
      base_focus: 30,
      distraction_level: 'hard',
      preferred_time: 'evening',
      use_case: 'coding',
      completed_at: 123456,
    });
    // MMKV re-hydrated so subsequent reads are sync.
    expect(JSON.parse(mmkvStore.get(ONBOARDING_KEY)!)).toEqual(result);
  });

  it('AC3c: returns null when MMKV empty and Firestore doc absent', async () => {
    getDoc.mockResolvedValue({ exists: () => false, data: () => undefined });
    expect(await loadOnboarding('u1')).toBeNull();
  });

  it('returns null when MMKV empty and no uid (no Firestore call)', async () => {
    expect(await loadOnboarding()).toBeNull();
    expect(getDoc).not.toHaveBeenCalled();
  });

  it('ignores corrupt MMKV JSON and falls through', async () => {
    mmkvStore.set(ONBOARDING_KEY, '{ not valid json');
    expect(await loadOnboarding()).toBeNull(); // no uid → null after the parse fails
  });
});

describe('clearOnboarding', () => {
  it('removes the answers blob AND the in-progress draft', () => {
    mmkvStore.set(ONBOARDING_KEY, JSON.stringify(sample()));
    mmkvStore.set(ONBOARDING_DRAFT_KEY, JSON.stringify({ base_focus: 45 }));
    clearOnboarding();
    expect(mmkvStore.has(ONBOARDING_KEY)).toBe(false);
    expect(mmkvStore.has(ONBOARDING_DRAFT_KEY)).toBe(false);
  });
});

describe('draft (S2.1 resume-on-kill)', () => {
  it('saveDraft writes a partial blob under floq.onboarding.draft', () => {
    saveDraft({ base_focus: 60, distraction_level: 'easy' });
    expect(JSON.parse(mmkvStore.get(ONBOARDING_DRAFT_KEY)!)).toEqual({
      base_focus: 60,
      distraction_level: 'easy',
    });
  });

  it('loadDraft round-trips what saveDraft wrote', () => {
    saveDraft({ base_focus: 30 });
    expect(loadDraft()).toEqual({ base_focus: 30 });
  });

  it('loadDraft returns {} on a fresh start and on a corrupt blob', () => {
    expect(loadDraft()).toEqual({});
    mmkvStore.set(ONBOARDING_DRAFT_KEY, '{ not valid json');
    expect(loadDraft()).toEqual({});
  });

  it('clearDraft removes only the draft, leaving the finalized answers blob', () => {
    mmkvStore.set(ONBOARDING_KEY, JSON.stringify(sample()));
    saveDraft({ base_focus: 45 });
    clearDraft();
    expect(mmkvStore.has(ONBOARDING_DRAFT_KEY)).toBe(false);
    expect(mmkvStore.has(ONBOARDING_KEY)).toBe(true);
  });
});
