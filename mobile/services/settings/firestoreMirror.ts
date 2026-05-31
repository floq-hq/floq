// Async Firestore mirror for app settings (cross-device sync, W6-sweep).
//
// One-way push: MMKV is the source of truth (services/settings/persist.ts); this
// reflects the whole settings blob to users/{uid}.settings with a server-clock
// `settings_updated_at` LWW marker. Owner-only (the M2.2 users/{uid} rule already
// authorizes it — same doc the L27 wipe tombstone writes; no rules change).
//
// Settings sync account-wide by owner decision (supersedes L23's per-device note
// for telemetryConsent): the consent flag is now one account-level switch. Local
// capture (training_outbox) stays unconditional; only UPLOAD is consent-gated, and
// each device reads the synced flag live at flush time — so flipping it on one
// device enables/disables egress on both, but never retroactively uploads samples
// captured before consent.
//
// Fire-and-forget: a failed mirror must never lose the local write or surface.

import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth } from '../firebase/auth';
import { db } from '../firebase/init';
import type { Settings } from './types';

/**
 * Mirror the settings blob to users/{uid}.settings. No-ops when signed out (MMKV
 * stays authoritative; reconcile on the next signed-in sync). Rejects only on a
 * Firestore write error — callers fire this and swallow.
 */
export async function mirrorSettings(settings: Settings): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  await setDoc(
    doc(db, 'users', uid),
    {
      settings: {
        backgroundPolicy: settings.backgroundPolicy,
        themeOverride: settings.themeOverride,
        telemetryConsent: settings.telemetryConsent,
        breakReminderEnabled: settings.breakReminderEnabled,
        sessionStartReminderEnabled: settings.sessionStartReminderEnabled,
      },
      // Server timestamp (not client ms) so cross-device LWW is immune to clock skew.
      settings_updated_at: serverTimestamp(),
    },
    { merge: true },
  );
}
