// Start-route resolver (M2.4).
//
// Pure decision function encoding the M2.4 redirect acceptance criteria, kept
// out of the UI so it's unit-testable and gives Mustafa's S2.0/S2.1 screens a
// single seam to gate navigation on:
//   - not signed in            -> auth (welcome/sign-in)
//   - signed in, no onboarding -> onboarding (Q1)
//   - signed in, onboarded     -> home
//
// `user` is intentionally `unknown` here — this module must not depend on the
// Firebase Auth types; callers pass `auth.currentUser` (or the useCurrentUser
// hook's value) and the onboarding-complete flag from useOnboardingStore.

export type StartRoute = 'auth' | 'onboarding' | 'home';

export function resolveStartRoute(args: {
  user: unknown | null;
  onboardingComplete: boolean;
}): StartRoute {
  if (!args.user) return 'auth';
  return args.onboardingComplete ? 'home' : 'onboarding';
}
