import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OnboardingAnswers } from '../../services/onboarding';

const { saveOnboarding, loadOnboarding, clearOnboarding } = vi.hoisted(() => ({
  saveOnboarding: vi.fn(),
  loadOnboarding: vi.fn(),
  clearOnboarding: vi.fn(),
}));

// Mock the I/O barrel so the store is tested in isolation (no MMKV / Firestore).
vi.mock('../../services/onboarding', () => ({
  saveOnboarding,
  loadOnboarding,
  clearOnboarding,
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
  useOnboardingStore.setState({ answers: null, draft: {}, hydrated: false });
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

  it('hydrate populates answers from loadOnboarding and flips hydrated', async () => {
    loadOnboarding.mockResolvedValue(complete);
    await useOnboardingStore.getState().hydrate('u1');
    expect(loadOnboarding).toHaveBeenCalledWith('u1');
    expect(useOnboardingStore.getState().answers).toEqual(complete);
    expect(useOnboardingStore.getState().hydrated).toBe(true);
  });

  it('reset clears state and the persisted blob', () => {
    useOnboardingStore.setState({ answers: complete, draft: { base_focus: 1 }, hydrated: true });
    useOnboardingStore.getState().reset();
    expect(clearOnboarding).toHaveBeenCalledTimes(1);
    expect(useOnboardingStore.getState()).toMatchObject({
      answers: null,
      draft: {},
      hydrated: false,
    });
  });
});
