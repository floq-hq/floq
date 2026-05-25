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
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebase/init';
import type { OnboardingAnswers } from './types';

export const ONBOARDING_KEY = 'floq.onboarding';

const storage = createMMKV();

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
 * Load answers. MMKV first (fast, offline); on a fresh install (empty MMKV)
 * fall back to Firestore when a uid is available, re-hydrating MMKV so later
 * reads stay synchronous. Returns null when nothing is found anywhere.
 */
export async function loadOnboarding(
  uid?: string,
): Promise<OnboardingAnswers | null> {
  const raw = storage.getString(ONBOARDING_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as OnboardingAnswers;
    } catch {
      // Corrupt blob — ignore and fall through to the Firestore fallback.
    }
  }

  if (!uid) return null;

  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;

  const ob = snap.data().onboarding as unknown;
  if (!ob || typeof ob !== 'object') return null;

  const answers = fromFirestore(ob as Record<string, unknown>);
  storage.set(ONBOARDING_KEY, JSON.stringify(answers)); // re-hydrate the cache
  return answers;
}

/** Clear persisted answers (store reset / future sign-out). LLM cache untouched. */
export function clearOnboarding(): void {
  storage.remove(ONBOARDING_KEY);
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
