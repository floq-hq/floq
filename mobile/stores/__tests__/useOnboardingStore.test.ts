import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OnboardingAnswers } from '../../services/onboarding';

const {
  saveOnboarding,
  loadOnboardingResolved,
  healOnboardingMirror,
  clearOnboarding,
  saveDraft,
  loadDraft,
  clearDraft,
} = vi.hoisted(() => ({
  saveOnboarding: vi.fn(),
  loadOnboardingResolved: vi.fn(),
  healOnboardingMirror: vi.fn(() => Promise.resolve()),
  clearOnboarding: vi.fn(),
  saveDraft: vi.fn(),
  loadDraft: vi.fn(() => ({})),
  clearDraft: vi.fn(),
}));

// Mock the I/O barrel so the store is tested in isolation (no MMKV / Firestore).
vi.mock('../../services/onboarding', () => ({
  saveOnboarding,
  loadOnboardingResolved,
  healOnboardingMirror,
  clearOnboarding,
  saveDraft,
  loadDraft,
  clearDraft,
}));

import { useOnboardingStore } from '../useOnboardingStore';

const complete: OnboardingAnswers = {
  base_focus: 45,
  distraction_level: 'neutral',
  preferred_time: 'morning',
  use_case: 'work',
  completed_at: 1000,
};

beforeEach(() => {
  vi.clearAllMocks();
  loadDraft.mockReturnValue({});
  healOnboardingMirror.mockResolvedValue(undefined);
  useOnboardingStore.setState({
    answers: null,
    draft: {},
    hydrated: false,
    onboardingUnresolved: false,
  });
});

describe('useOnboardingStore', () => {
  it('setAnswer accumulates per-question edits into draft', () => {
    const { setAnswer } = useOnboardingStore.getState();
    setAnswer('base_focus', 50);
    setAnswer('use_case', 'coding');
    expect(useOnboardingStore.getState().draft).toEqual({
      base_focus: 50,
      use_case: 'coding',
    });
  });

  it('setAnswer persists the accumulated draft to MMKV on every edit (resume-on-kill)', () => {
    const { setAnswer } = useOnboardingStore.getState();
    setAnswer('base_focus', 50);
    setAnswer('distraction_level', 'easy');
    expect(saveDraft).toHaveBeenCalledTimes(2);
    expect(saveDraft).toHaveBeenLastCalledWith({ base_focus: 50, distraction_level: 'easy' });
  });

  it('hydrate restores a partial draft when onboarding is server-confirmed absent', async () => {
    loadOnboardingResolved.mockResolvedValue({ status: 'absent' });
    loadDraft.mockReturnValueOnce({ base_focus: 30, distraction_level: 'hard' });
    await useOnboardingStore.getState().hydrate('u1');
    expect(useOnboardingStore.getState().answers).toBeNull();
    expect(useOnboardingStore.getState().draft).toEqual({ base_focus: 30, distraction_level: 'hard' });
    expect(useOnboardingStore.getState().onboardingUnresolved).toBe(false);
  });

  it('hydrate ignores any draft once onboarding is finalized (found)', async () => {
    loadOnboardingResolved.mockResolvedValue({ status: 'found', answers: complete });
    await useOnboardingStore.getState().hydrate('u1');
    expect(loadDraft).not.toHaveBeenCalled();
    expect(useOnboardingStore.getState().draft).toEqual({});
  });

  it('hydrate (found) fires the write-heal with the uid + answers', async () => {
    loadOnboardingResolved.mockResolvedValue({ status: 'found', answers: complete });
    await useOnboardingStore.getState().hydrate('u1');
    expect(healOnboardingMirror).toHaveBeenCalledWith('u1', complete);
  });

  it('hydrate: UNKNOWN read on a brand-new account → onboarding (no false Home)', async () => {
    loadOnboardingResolved.mockResolvedValue({ status: 'unknown' });
    loadDraft.mockReturnValueOnce({ base_focus: 30 });
    await useOnboardingStore.getState().hydrate('u1', { isBrandNew: true });
    const s = useOnboardingStore.getState();
    expect(s.answers).toBeNull();
    expect(s.draft).toEqual({ base_focus: 30 });
    expect(s.onboardingUnresolved).toBe(false); // → routes to Q1
  });

  it('hydrate: UNKNOWN read on a RETURNING account → unresolved (routes Home, never Q1)', async () => {
    loadOnboardingResolved.mockResolvedValue({ status: 'unknown' });
    await useOnboardingStore.getState().hydrate('u1', { isBrandNew: false });
    const s = useOnboardingStore.getState();
    expect(s.answers).toBeNull();
    expect(s.hydrated).toBe(true);
    expect(s.onboardingUnresolved).toBe(true);
  });

  it('hydrate: UNKNOWN read with no brand-new hint defaults to RETURNING (unresolved)', async () => {
    loadOnboardingResolved.mockResolvedValue({ status: 'unknown' });
    await useOnboardingStore.getState().hydrate('u1');
    expect(useOnboardingStore.getState().onboardingUnresolved).toBe(true);
  });

  it('hydrate: server-confirmed ABSENT routes to onboarding even for a brand-new account', async () => {
    loadOnboardingResolved.mockResolvedValue({ status: 'absent' });
    await useOnboardingStore.getState().hydrate('u1', { isBrandNew: true });
    const s = useOnboardingStore.getState();
    expect(s.answers).toBeNull();
    expect(s.onboardingUnresolved).toBe(false);
  });

  it.each([
    ['found', { status: 'found', answers: complete }],
    ['absent', { status: 'absent' }],
    ['unknown', { status: 'unknown' }],
  ] as const)('hydrate always flips hydrated:true (%s) — never strands the splash', async (_n, r) => {
    loadOnboardingResolved.mockResolvedValue(r);
    await useOnboardingStore.getState().hydrate('u1');
    expect(useOnboardingStore.getState().hydrated).toBe(true);
  });

  it('finalize drops the persisted draft once the complete blob is saved', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    useOnboardingStore.setState({
      draft: {
        base_focus: 45,
        distraction_level: 'neutral',
        preferred_time: 'morning',
        use_case: 'work',
      },
    });
    await useOnboardingStore.getState().finalize();
    expect(clearDraft).toHaveBeenCalledTimes(1);
  });

  it('finalize builds complete answers, stamps completed_at, persists, and sets answers', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const { setAnswer } = useOnboardingStore.getState();
    setAnswer('base_focus', 45);
    setAnswer('distraction_level', 'neutral');
    setAnswer('preferred_time', 'morning');
    setAnswer('use_case', 'work');

    await useOnboardingStore.getState().finalize();

    expect(saveOnboarding).toHaveBeenCalledTimes(1);
    expect(saveOnboarding).toHaveBeenCalledWith(complete, undefined);
    expect(useOnboardingStore.getState().answers).toEqual(complete);
    expect(useOnboardingStore.getState().draft).toEqual({});
  });

  it('finalize passes uid through to saveOnboarding', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    useOnboardingStore.setState({
      draft: {
        base_focus: 45,
        distraction_level: 'neutral',
        preferred_time: 'morning',
        use_case: 'work',
      },
    });
    await useOnboardingStore.getState().finalize('u1');
    expect(saveOnboarding).toHaveBeenCalledWith(complete, 'u1');
  });

  it('finalize throws when answers are incomplete (and does not persist)', async () => {
    useOnboardingStore.getState().setAnswer('base_focus', 45);
    await expect(useOnboardingStore.getState().finalize()).rejects.toThrow(
      /all of Q1–Q4/,
    );
    expect(saveOnboarding).not.toHaveBeenCalled();
  });

  it('hydrate populates answers from loadOnboardingResolved and flips hydrated', async () => {
    loadOnboardingResolved.mockResolvedValue({ status: 'found', answers: complete });
    await useOnboardingStore.getState().hydrate('u1');
    expect(loadOnboardingResolved).toHaveBeenCalledWith('u1');
    expect(useOnboardingStore.getState().answers).toEqual(complete);
    expect(useOnboardingStore.getState().hydrated).toBe(true);
  });

  it('reset clears state, the unresolved flag, and the persisted blob', () => {
    useOnboardingStore.setState({
      answers: complete,
      draft: { base_focus: 1 },
      hydrated: true,
      onboardingUnresolved: true,
    });
    useOnboardingStore.getState().reset();
    expect(clearOnboarding).toHaveBeenCalledTimes(1);
    expect(useOnboardingStore.getState()).toMatchObject({
      answers: null,
      draft: {},
      hydrated: false,
      onboardingUnresolved: false,
    });
  });
});
