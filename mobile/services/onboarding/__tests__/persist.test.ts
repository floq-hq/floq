import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OnboardingAnswers } from '../types';

// --- Mocks: every native / SDK boundary is replaced so this runs in plain node.
// Shared refs are created via vi.hoisted so the (hoisted) vi.mock factories can
// close over them.
const { mmkvStore, setDoc, getDoc, getDocFromServer } = vi.hoisted(() => ({
  mmkvStore: new Map<string, string>(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocFromServer: vi.fn(),
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
  getDocFromServer: (...args: unknown[]) => getDocFromServer(...args),
  serverTimestamp: () => ({ __serverTimestamp: true }),
}));

import {
  ONBOARDING_KEY,
  ONBOARDING_DRAFT_KEY,
  saveOnboarding,
  loadOnboarding,
  loadOnboardingResolved,
  healOnboardingMirror,
  isBrandNewAccount,
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
  getDocFromServer.mockReset();
});

function serverSnap(onboarding?: object) {
  return { exists: () => true, data: () => (onboarding ? { onboarding } : {}) };
}

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

describe('loadOnboarding (back-compat shim)', () => {
  it('AC3a: reads MMKV first without hitting Firestore', async () => {
    const answers = sample();
    mmkvStore.set(ONBOARDING_KEY, JSON.stringify(answers));

    const result = await loadOnboarding('u1');

    expect(result).toEqual(answers);
    expect(getDoc).not.toHaveBeenCalled();
    expect(getDocFromServer).not.toHaveBeenCalled();
  });

  it('AC3b: falls back to Firestore on fresh install, converts Timestamp→ms, re-hydrates MMKV', async () => {
    getDocFromServer.mockResolvedValue({
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
    getDocFromServer.mockResolvedValue({ exists: () => false, data: () => undefined });
    expect(await loadOnboarding('u1')).toBeNull();
  });

  it('maps an UNKNOWN (read failed) outcome to null', async () => {
    vi.useFakeTimers();
    try {
      getDocFromServer.mockRejectedValue(new Error('offline'));
      getDoc.mockRejectedValue(new Error('offline'));
      const p = loadOnboarding('u1');
      await vi.advanceTimersByTimeAsync(700);
      expect(await p).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('returns null when MMKV empty and no uid (no Firestore call)', async () => {
    expect(await loadOnboarding()).toBeNull();
    expect(getDoc).not.toHaveBeenCalled();
    expect(getDocFromServer).not.toHaveBeenCalled();
  });

  it('ignores corrupt MMKV JSON and falls through', async () => {
    mmkvStore.set(ONBOARDING_KEY, '{ not valid json');
    expect(await loadOnboarding()).toBeNull(); // no uid → null after the parse fails
  });
});

describe('loadOnboardingResolved (tri-state)', () => {
  it('MMKV hit short-circuits to found with no network read', async () => {
    const answers = sample();
    mmkvStore.set(ONBOARDING_KEY, JSON.stringify(answers));

    expect(await loadOnboardingResolved('u1')).toEqual({ status: 'found', answers });
    expect(getDoc).not.toHaveBeenCalled();
    expect(getDocFromServer).not.toHaveBeenCalled();
  });

  it('re-login: server has the onboarding field → found + rehydrates MMKV', async () => {
    getDocFromServer.mockResolvedValue(serverSnap(sample()));
    const r = await loadOnboardingResolved('u1');
    expect(r).toEqual({ status: 'found', answers: sample() });
    expect(JSON.parse(mmkvStore.get(ONBOARDING_KEY)!)).toEqual(sample());
  });

  it('server doc exists but has no onboarding field → absent', async () => {
    getDocFromServer.mockResolvedValue(serverSnap()); // exists, no onboarding
    expect(await loadOnboardingResolved('u1')).toEqual({ status: 'absent' });
  });

  it('server doc absent → absent', async () => {
    getDocFromServer.mockResolvedValue({ exists: () => false, data: () => undefined });
    expect(await loadOnboardingResolved('u1')).toEqual({ status: 'absent' });
  });

  it('server unreachable but cache holds answers → found', async () => {
    getDocFromServer.mockRejectedValue(new Error('offline'));
    getDoc.mockResolvedValue(serverSnap(sample()));
    expect(await loadOnboardingResolved('u1')).toEqual({ status: 'found', answers: sample() });
  });

  it('server unreachable + empty cache → unknown, NOT a false absent', async () => {
    vi.useFakeTimers();
    try {
      getDocFromServer.mockRejectedValue(new Error('offline'));
      getDoc.mockRejectedValue(new Error('offline'));
      const p = loadOnboardingResolved('u1');
      await vi.advanceTimersByTimeAsync(700); // flush the 150ms + 400ms backoffs
      expect(await p).toEqual({ status: 'unknown' });
      expect(getDocFromServer).toHaveBeenCalledTimes(3); // 3 bounded attempts
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries: fails once, succeeds on the 2nd attempt → found', async () => {
    vi.useFakeTimers();
    try {
      getDocFromServer
        .mockRejectedValueOnce(new Error('token not ready'))
        .mockResolvedValueOnce(serverSnap(sample()));
      getDoc.mockRejectedValue(new Error('offline')); // cache miss on the 1st attempt
      const p = loadOnboardingResolved('u1');
      await vi.advanceTimersByTimeAsync(200); // flush the first 150ms backoff
      expect(await p).toEqual({ status: 'found', answers: sample() });
      expect(getDocFromServer).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a hung socket resolves unknown via the overall timeout', async () => {
    vi.useFakeTimers();
    try {
      getDocFromServer.mockReturnValue(new Promise(() => {})); // never settles
      const p = loadOnboardingResolved('u1');
      await vi.advanceTimersByTimeAsync(1300); // past READ_TIMEOUT_MS
      expect(await p).toEqual({ status: 'unknown' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('no uid + empty MMKV → absent with no network call', async () => {
    expect(await loadOnboardingResolved()).toEqual({ status: 'absent' });
    expect(getDoc).not.toHaveBeenCalled();
    expect(getDocFromServer).not.toHaveBeenCalled();
  });
});

describe('healOnboardingMirror', () => {
  it('re-asserts the mirror (preserving completed_at) when the server lacks it', async () => {
    getDoc.mockResolvedValue(serverSnap()); // doc exists, no onboarding field
    await healOnboardingMirror('u1', sample({ completed_at: 777 }));

    expect(setDoc).toHaveBeenCalledTimes(1);
    const [ref, payload, opts] = setDoc.mock.calls[0];
    expect(ref).toEqual({ path: 'users/u1' });
    expect(payload).toEqual({
      onboarding: {
        base_focus: 45,
        distraction_level: 'neutral',
        preferred_time: 'morning',
        use_case: 'work',
        completed_at: 777, // true local time, NOT a fresh serverTimestamp
      },
    });
    expect(opts).toEqual({ merge: true });
  });

  it('is a no-op when the server already has the onboarding field', async () => {
    getDoc.mockResolvedValue(serverSnap(sample()));
    await healOnboardingMirror('u1', sample());
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('is a no-op when no uid is given', async () => {
    await healOnboardingMirror(undefined, sample());
    expect(getDoc).not.toHaveBeenCalled();
    expect(setDoc).not.toHaveBeenCalled();
  });

  it('swallows a read failure (best-effort)', async () => {
    getDoc.mockRejectedValue(new Error('offline'));
    await expect(healOnboardingMirror('u1', sample())).resolves.toBeUndefined();
    expect(setDoc).not.toHaveBeenCalled();
  });
});

describe('isBrandNewAccount', () => {
  it('true when creationTime ≈ lastSignInTime (first-ever sign-in)', () => {
    const t = '2026-06-01T10:00:00.000Z';
    expect(isBrandNewAccount({ creationTime: t, lastSignInTime: t })).toBe(true);
  });

  it('false when lastSignInTime has advanced past creationTime (returning user)', () => {
    expect(
      isBrandNewAccount({
        creationTime: '2026-05-01T10:00:00.000Z',
        lastSignInTime: '2026-06-01T10:00:00.000Z',
      }),
    ).toBe(false);
  });

  it('false (safe default) when metadata is missing or unparseable', () => {
    expect(isBrandNewAccount()).toBe(false);
    expect(isBrandNewAccount({})).toBe(false);
    expect(isBrandNewAccount({ creationTime: 'nope', lastSignInTime: 'nope' })).toBe(false);
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
