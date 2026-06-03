// S7.0 claim-state copy — maps every acceptInvite outcome to user-facing copy.
//
// Pure + React-free + tested. The accept flow (InviteCodeField) calls
// acceptInvite, catches the typed AcceptError, and renders claimCopy(outcome).
// `offline` is synthetic: acceptInvite never throws it, but the call site maps a
// network failure to it (the code is persisted; the action is Retry).
//
// `action` drives the single button under the message:
//   'retry'   → re-attempt the same code (offline seam)
//   'edit'    → clear/refocus the field for a different code
//   'dismiss' → acknowledge, no retry (terminal — e.g. already have a partner)

import type { AcceptReason } from '../firebase';

// 'offline' (true connectivity drop) and 'failed' (a server rejection / unexpected
// error — e.g. permission-denied) are synthetic: acceptInvite never throws them,
// the call site maps a non-AcceptError to one or the other (see acceptError.ts).
export type AcceptOutcome =
  | { kind: 'paired'; alreadyPaired: boolean }
  | { kind: 'error'; reason: AcceptReason | 'offline' | 'failed' };

export type ClaimAction = 'retry' | 'edit' | 'dismiss';
export type ClaimTone = 'success' | 'neutral' | 'danger';

export interface ClaimCopy {
  title: string;
  body: string;
  action: ClaimAction;
  actionLabel: string;
  tone: ClaimTone;
}

export function claimCopy(outcome: AcceptOutcome): ClaimCopy {
  if (outcome.kind === 'paired') {
    return outcome.alreadyPaired
      ? {
          title: "You're already paired",
          body: "You two are already connected — you're all set.",
          action: 'dismiss',
          actionLabel: 'Got it',
          tone: 'neutral',
        }
      : {
          title: "You're paired",
          body: 'Nice — you can focus together now. Solo still works exactly the same.',
          action: 'dismiss',
          actionLabel: 'Done',
          tone: 'success',
        };
  }

  switch (outcome.reason) {
    case 'offline':
      return {
        title: "You're offline",
        body: "We couldn't reach the server. Your code is saved — try again when you're back online.",
        action: 'retry',
        actionLabel: 'Retry',
        tone: 'neutral',
      };
    case 'failed':
      return {
        // A server rejection / unexpected error — honestly NOT "offline".
        title: "That didn't go through",
        body: "Something went wrong on our end. Give it another try in a moment — if it keeps happening, let us know.",
        action: 'retry',
        actionLabel: 'Retry',
        tone: 'danger',
      };
    case 'bad-code':
      return {
        title: 'Check that code',
        body: "An invite code is 6 characters (letters and numbers). Re-enter it and we'll try again.",
        action: 'edit',
        actionLabel: 'Edit code',
        tone: 'neutral',
      };
    case 'code-not-found':
      return {
        title: "We couldn't find that code",
        body: 'Double-check the characters, or ask your friend for a fresh code.',
        action: 'edit',
        actionLabel: 'Try again',
        tone: 'neutral',
      };
    case 'self-pair':
      return {
        title: "That's your own code",
        body: 'Share it with a friend instead — they enter it to pair with you.',
        action: 'edit',
        actionLabel: 'Enter a different code',
        tone: 'neutral',
      };
    case 'revoked':
      return {
        title: 'That invite was cancelled',
        body: 'Ask your friend to send you a new code.',
        action: 'edit',
        actionLabel: 'Try a new code',
        tone: 'neutral',
      };
    case 'expired':
      return {
        title: 'That invite expired',
        body: 'Invites last 72 hours. Ask your friend for a fresh code.',
        action: 'edit',
        actionLabel: 'Try a new code',
        tone: 'neutral',
      };
    case 'already-paired':
      return {
        title: 'You already have a partner',
        body: 'End your current partnership first if you want to pair with someone new.',
        action: 'dismiss',
        actionLabel: 'Got it',
        tone: 'neutral',
      };
    case 'inviter-already-paired':
      return {
        title: 'They already have a partner',
        body: 'Looks like they paired with someone else. Ask for a new code if that changes.',
        action: 'edit',
        actionLabel: 'Try a different code',
        tone: 'neutral',
      };
    case 'ended':
      return {
        title: 'You unpaired before',
        body: 'You two were partners earlier. To reconnect, ask for a fresh invite code.',
        action: 'edit',
        actionLabel: 'Enter a new code',
        tone: 'neutral',
      };
    case 'not-signed-in':
      return {
        title: 'Sign in first',
        body: 'You need to be signed in to pair with a partner.',
        action: 'dismiss',
        actionLabel: 'Got it',
        tone: 'danger',
      };
    default: {
      // Exhaustiveness guard: a new AcceptReason must add a case above.
      const _exhaustive: never = outcome.reason;
      return {
        title: 'Something went wrong',
        body: 'Please try again.',
        action: 'retry',
        actionLabel: 'Retry',
        tone: 'danger',
      };
    }
  }
}
