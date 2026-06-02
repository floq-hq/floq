// Onboarding persistence (M2.2).
//
// Two layers, per shared/spec/onboarding.md + tasks.md:
//   - MMKV  — synchronous source of truth, one atomic JSON blob. Works offline
//             and with no auth, so it is always written/read first.
//   - Firestore — async cross-device mirror at users/{uid}, merged into the
//             user doc. Auth (and therefore uid) arrives in M2.4; until then the
//             Firestore path is simply skipped (uid undefined).
//
// React-free. This module owns ALL MMKV access for onboarding; the Zustand
// store calls in here, never the reverse.

import { createMMKV } from 'react-native-mmkv';
import { doc, getDoc, getDocFromServer, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/init';
import type { OnboardingAnswers } from './types';

export const ONBOARDING_KEY = 'floq.onboarding';
// In-progress Q1–Q4 edits (S2.1). Kept separate from the finalized blob so a
// kill mid-flow resumes on the next unanswered question, and so finalize can
// drop the draft without disturbing the source-of-truth answers.
export const ONBOARDING_DRAFT_KEY = 'floq.onboarding.draft';

const storage = createMMKV();

// Tunable knobs for the Firestore onboarding fallback (NOT frozen science
// constants — those live only in services/timer). The retry targets the brief
// auth-token-propagation window right after an account switch; the timeout is a
// hard cap so a hung socket never pins the boot splash.
const READ_RETRY_DELAYS_MS = [150, 400]; // delays BETWEEN the 3 read attempts
const READ_TIMEOUT_MS = 1200;
// A brand-new account signs in for the first time, so creationTime ≈
// lastSignInTime; a returning account's lastSignInTime has advanced far past it.
const NEW_ACCOUNT_WINDOW_MS = 5_000; // tolerance for clock/precision skew

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Persist answers. MMKV is written first, synchronously and atomically (single
 * blob), so the source of truth is safe even if the Firestore mirror later
 * rejects. The Firestore write is attempted only when a uid is available.
 */
export async function saveOnboarding(
  answers: OnboardingAnswers,
  uid?: string,
): Promise<void> {
  storage.set(ONBOARDING_KEY, JSON.stringify(answers));

  if (uid) {
    // Merge so the signup skeleton (M2.4) and sibling fields aren't clobbered.
    // completed_at is the server clock here; locally we keep epoch ms.
    await setDoc(
      doc(db, 'users', uid),
      {
        onboarding: {
          base_focus: answers.base_focus,
          distraction_level: answers.distraction_level,
          preferred_time: answers.preferred_time,
          use_case: answers.use_case,
          completed_at: serverTimestamp(),
        },
      },
      { merge: true },
    );
  }
}

/**
 * The outcome of resolving onboarding state. The distinction between `absent`
 * and `unknown` is load-bearing for routing: `absent` is a server-CONFIRMED "no
 * onboarding" (→ a genuinely new user belongs in the flow), while `unknown` is
 * "we couldn't read it" (a transient failure / offline) and must NEVER be
 * mistaken for a new user — that is the re-login re-prompt bug.
 */
export type OnboardingLoad =
  | { status: 'found'; answers: OnboardingAnswers }
  | { status: 'absent' }
  | { status: 'unknown' };

/** Classify a server-authoritative snapshot into found/absent. */
function classifyDoc(snap: {
  exists: () => boolean;
  data: () => Record<string, unknown> | undefined;
}): OnboardingLoad {
  if (!snap.exists()) return { status: 'absent' };
  const ob = snap.data()?.onboarding as unknown;
  if (!ob || typeof ob !== 'object') return { status: 'absent' };
  return { status: 'found', answers: fromFirestore(ob as Record<string, unknown>) };
}

/**
 * Read users/{uid} with a bounded retry, distinguishing a trustworthy result
 * from "couldn't reach the server". `getDocFromServer` forces a round-trip so a
 * stale/empty local cache (common right after an account switch) cannot
 * masquerade as `absent`. If the server is unreachable, a CACHED doc is trusted
 * ONLY when it already holds answers — an empty cache hit is `unknown`, not
 * `absent`. Returns found/absent only when confirmed; otherwise `unknown`.
 */
async function resolveFromFirestore(uid: string): Promise<OnboardingLoad> {
  const ref = doc(db, 'users', uid);

  const attempt = async (): Promise<OnboardingLoad> => {
    try {
      return classifyDoc(await getDocFromServer(ref)); // server-authoritative
    } catch {
      // Offline / unavailable: a cached copy is trustworthy only if it has answers.
      try {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const ob = snap.data()?.onboarding as unknown;
          if (ob && typeof ob === 'object') {
            return { status: 'found', answers: fromFirestore(ob as Record<string, unknown>) };
          }
        }
      } catch {
        // ignore — fall through to an unresolved attempt
      }
      return { status: 'unknown' };
    }
  };

  let result: OnboardingLoad = { status: 'unknown' };
  for (let i = 0; i <= READ_RETRY_DELAYS_MS.length; i++) {
    result = await attempt();
    if (result.status !== 'unknown') return result; // resolved → stop retrying
    if (i < READ_RETRY_DELAYS_MS.length) await sleep(READ_RETRY_DELAYS_MS[i]);
  }
  return result;
}

/**
 * Resolve onboarding state. MMKV first (fast, offline); on empty MMKV fall back
 * to a bounded, server-authoritative Firestore read when a uid is available,
 * re-hydrating MMKV on a hit so later reads stay synchronous. The whole fallback
 * is capped at READ_TIMEOUT_MS so a hung socket never strands the boot splash.
 */
export async function loadOnboardingResolved(
  uid?: string,
): Promise<OnboardingLoad> {
  const raw = storage.getString(ONBOARDING_KEY);
  if (raw) {
    try {
      return { status: 'found', answers: JSON.parse(raw) as OnboardingAnswers };
    } catch {
      // Corrupt blob — ignore and fall through to the Firestore fallback.
    }
  }

  // No local answers and no identity → a fresh local start (new offline user).
  if (!uid) return { status: 'absent' };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<OnboardingLoad>((resolve) => {
    timer = setTimeout(() => resolve({ status: 'unknown' }), READ_TIMEOUT_MS);
  });
  try {
    const result = await Promise.race([resolveFromFirestore(uid), timeout]);
    if (result.status === 'found') {
      storage.set(ONBOARDING_KEY, JSON.stringify(result.answers)); // re-hydrate cache
    }
    return result;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Back-compat shim: the original null-returning loader, expressed over the
 * tri-state resolver. Existing callers/tests keep working; the store uses the
 * resolved variant so it can tell `absent` from `unknown`.
 */
export async function loadOnboarding(
  uid?: string,
): Promise<OnboardingAnswers | null> {
  const result = await loadOnboardingResolved(uid);
  return result.status === 'found' ? result.answers : null;
}

/**
 * Repair a dropped server mirror. The Firestore JS SDK resolves an offline
 * `setDoc` optimistically against its local queue, so an onboarding finalize can
 * "succeed" locally yet never flush to the server if the user signs out first —
 * leaving the server doc without an `onboarding` field, which re-prompts on the
 * next re-login. Called fire-and-forget when we DO have answers (MMKV/server):
 * if the server lacks the field, re-assert it idempotently, preserving the true
 * (local epoch-ms) completion time rather than stamping "now". Best-effort.
 */
export async function healOnboardingMirror(
  uid: string | undefined,
  answers: OnboardingAnswers,
): Promise<void> {
  if (!uid) return;
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    const ob = snap.exists() ? (snap.data()?.onboarding as unknown) : undefined;
    if (ob && typeof ob === 'object') return; // mirror already present — no-op

    await setDoc(
      doc(db, 'users', uid),
      {
        onboarding: {
          base_focus: answers.base_focus,
          distraction_level: answers.distraction_level,
          preferred_time: answers.preferred_time,
          use_case: answers.use_case,
          completed_at: answers.completed_at, // preserve true completion time
        },
      },
      { merge: true },
    );
  } catch {
    // Best-effort; self-heals on a later boot (mirrors services/intro/seen.ts).
  }
}

/**
 * Whether the signed-in account is brand-new (first-ever sign-in) vs returning,
 * from the Firebase user's metadata timestamps. A brand-new account has
 * creationTime ≈ lastSignInTime; a returning account's lastSignInTime has moved
 * on. Pure — takes only the two ISO strings. Missing/unparseable metadata →
 * `false` (treat as RETURNING: the safe default that never re-prompts onboarding
 * on an unconfirmed read).
 */
export function isBrandNewAccount(meta?: {
  creationTime?: string;
  lastSignInTime?: string;
}): boolean {
  const created = meta?.creationTime ? Date.parse(meta.creationTime) : NaN;
  const lastSeen = meta?.lastSignInTime ? Date.parse(meta.lastSignInTime) : NaN;
  if (Number.isNaN(created) || Number.isNaN(lastSeen)) return false;
  return Math.abs(lastSeen - created) <= NEW_ACCOUNT_WINDOW_MS;
}

/** Clear persisted answers (store reset / future sign-out). LLM cache untouched. */
export function clearOnboarding(): void {
  storage.remove(ONBOARDING_KEY);
  storage.remove(ONBOARDING_DRAFT_KEY);
}

/**
 * Persist the in-progress draft (S2.1). Written synchronously on every answer so
 * a kill mid-flow loses nothing — the flow resumes at the first unanswered
 * question. Dropped by finalize() once the complete blob is saved.
 */
export function saveDraft(draft: Partial<OnboardingAnswers>): void {
  storage.set(ONBOARDING_DRAFT_KEY, JSON.stringify(draft));
}

/** Load the in-progress draft. Returns {} on a fresh start or a corrupt blob. */
export function loadDraft(): Partial<OnboardingAnswers> {
  const raw = storage.getString(ONBOARDING_DRAFT_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<OnboardingAnswers>;
  } catch {
    return {};
  }
}

/** Drop the in-progress draft (on finalize). Leaves the finalized answers blob. */
export function clearDraft(): void {
  storage.remove(ONBOARDING_DRAFT_KEY);
}

/** Normalize a Firestore onboarding map into local answers (Timestamp → ms). */
function fromFirestore(ob: Record<string, unknown>): OnboardingAnswers {
  return {
    base_focus: ob.base_focus as number,
    distraction_level: ob.distraction_level as OnboardingAnswers['distraction_level'],
    preferred_time: ob.preferred_time as OnboardingAnswers['preferred_time'],
    use_case: ob.use_case as OnboardingAnswers['use_case'],
    completed_at: toMillis(ob.completed_at),
  };
}

/** Firestore Timestamp | epoch-ms number | missing → epoch ms. */
function toMillis(value: unknown): number {
  if (
    value != null &&
    typeof value === 'object' &&
    'toMillis' in value &&
    typeof (value as { toMillis: unknown }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === 'number') return value;
  return Date.now();
}
