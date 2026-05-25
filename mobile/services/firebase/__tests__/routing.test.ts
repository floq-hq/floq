import { describe, it, expect } from 'vitest';
import { resolveStartRoute } from '../routing';

describe('resolveStartRoute', () => {
  it('sends a signed-out visitor to auth', () => {
    expect(resolveStartRoute({ user: null, onboardingComplete: false })).toBe('auth');
    // onboardingComplete is irrelevant without a user
    expect(resolveStartRoute({ user: null, onboardingComplete: true })).toBe('auth');
  });

  it('AC: a new signed-in user with no onboarding goes to onboarding (Q1)', () => {
    expect(resolveStartRoute({ user: { uid: 'u1' }, onboardingComplete: false })).toBe(
      'onboarding',
    );
  });

  it('AC: a signed-in user who finished onboarding goes home', () => {
    expect(resolveStartRoute({ user: { uid: 'u1' }, onboardingComplete: true })).toBe('home');
  });
});
