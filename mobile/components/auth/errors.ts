/**
 * Maps Firebase Auth error codes to calm, user-facing copy (no playful tone,
 * no raw codes). Falls back to a mode-specific generic message.
 */
export function authErrorMessage(error: unknown, mode: 'sign-in' | 'sign-up'): string {
  const code = (error as { code?: string } | null)?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return 'That email doesn’t look right.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Incorrect email or password.';
    case 'auth/email-already-in-use':
      return 'That email is already registered. Try signing in instead.';
    case 'auth/weak-password':
      return 'Choose a stronger password (at least 8 characters).';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.';
    case 'auth/network-request-failed':
      return 'Network error. Check your connection and try again.';
    default:
      return mode === 'sign-up'
        ? 'Could not create your account. Please try again.'
        : 'Could not sign you in. Please try again.';
  }
}
