// S7.2 — the OS notification permission for social pings (a partner's reaction /
// "they finished") is requested SEPARATELY from the share-consent toggle, at the
// first natural moment that earns it: the user's SECOND session-end OR their
// FIRST reaction, whichever comes first. Asked at most once. Never bundled with
// consent (a default-OFF privacy toggle must not trigger an OS dialog) and never
// on app open (S4.2). Reuses the existing ensurePermission() prompt.
//
// Pure decision (decideSocialNotifPrompt) is split from the MMKV/permission I/O
// so the "2nd end / first reaction / once" logic is unit-tested without native.

import { createMMKV } from 'react-native-mmkv';
import { ensurePermission } from '../notifications';

export type SocialNotifTrigger = 'session-end' | 'reaction';

export interface SocialNotifState {
  asked: boolean;
  sessionEnds: number;
}

export interface SocialNotifDecision {
  /** Request the OS permission now. */
  ask: boolean;
  /** Persist this state back. */
  next: SocialNotifState;
}

// The earliest moment social pings are worth a prompt: a reaction is immediate
// intent; a session-end only counts from the SECOND (the first end already
// prompts for the break reminder — don't double-ask on day one).
const SESSION_END_THRESHOLD = 2;

/** Pure: given the stored state + the trigger, decide whether to prompt now and
 *  what to persist. Idempotent once `asked` is true. */
export function decideSocialNotifPrompt(
  state: SocialNotifState,
  trigger: SocialNotifTrigger,
): SocialNotifDecision {
  if (state.asked) return { ask: false, next: state };

  if (trigger === 'reaction') {
    return { ask: true, next: { ...state, asked: true } };
  }

  // session-end: count it; only ask once we reach the threshold.
  const sessionEnds = state.sessionEnds + 1;
  if (sessionEnds < SESSION_END_THRESHOLD) {
    return { ask: false, next: { ...state, sessionEnds } };
  }
  return { ask: true, next: { asked: true, sessionEnds } };
}

const storage = createMMKV();
const ASKED_KEY = 'floq.social.notifAsked';
const ENDS_KEY = 'floq.social.sessionEnds';

function load(): SocialNotifState {
  return {
    asked: storage.getBoolean(ASKED_KEY) ?? false,
    sessionEnds: storage.getNumber(ENDS_KEY) ?? 0,
  };
}

function save(state: SocialNotifState): void {
  storage.set(ASKED_KEY, state.asked);
  storage.set(ENDS_KEY, state.sessionEnds);
}

/**
 * Maybe request the OS notification permission for social pings. Fire-and-forget;
 * silent no-op if already asked or already (denied &&) can't-ask. Call from the
 * first-reaction path and at session-end (focus.tsx onDone).
 */
export async function maybeRequestSocialNotifPermission(
  trigger: SocialNotifTrigger,
): Promise<void> {
  const { ask, next } = decideSocialNotifPrompt(load(), trigger);
  save(next);
  if (ask) await ensurePermission(true);
}
