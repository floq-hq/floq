// ML training-sample egress (L23) — the consent-gated UPLOAD half.
//
// Local capture (storage/trainingOutbox) stages anonymized samples unconditionally
// (L2-clean). THIS module uploads settled, un-uploaded samples to the top-level
// `training_samples` collection — ONLY while the user has opted in
// (settings.telemetryConsent, default OFF). Best-effort: a failed upload leaves the
// row un-uploaded for the next flush; SQLite stays the truth and the app never
// blocks or surfaces an error.
//
// HARD INVARIANT (L23 / L4): the uploaded doc is ANONYMOUS — no uid, no email, no
// display name, no task title, NO session id, no free text. `sessionId` is used
// only locally to mark the row uploaded; it never reaches Firestore. The doc is
// top-level + unlinked to any account on purpose (anonymous ≠ personal data).
//
// Rules: `training_samples` is create-only with strict shape validation
// (backend/firestore.rules). Retraining reads it offline via the Admin SDK.

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/init';
import { auth } from '../firebase/auth';
import {
  markUploaded,
  takeSettledUnuploaded,
  type TrainingSample,
} from '../storage/trainingOutbox';
import { useSettingsStore } from '../../stores/useSettingsStore';

// App version stamped for provenance. Mirrors app/focus.tsx's CLIENT_VERSION
// (no expo-constants dependency); bump alongside app.json on release.
const CLIENT_VERSION = '1.0.0';

/** Pure: map a staged TrainingSample → the anonymized `training_samples` doc
 *  (schema.md / L23). Deliberately omits `sessionId` — the uploaded doc carries
 *  NO identifier. `created_at` is the server clock at write time. */
export function toTrainingSampleDoc(sample: TrainingSample, clientVersion: string) {
  return {
    features: sample.features,
    focus_score: sample.focusScore,
    actual_focus_minutes: sample.actualFocusMinutes,
    planned_focus_minutes: sample.plannedFocusMinutes,
    task_completed: sample.taskCompleted,
    regime: sample.regime,
    model_version: sample.modelVersion,
    client_version: clientVersion,
    created_at: serverTimestamp(),
  };
}

/**
 * Upload settled, un-uploaded training samples — gated on consent. No-op when
 * telemetry consent is OFF or the user is signed out. Each sample is created as
 * its own anonymized doc, then marked uploaded locally on success; a failed
 * upload is left for the next flush. Resolves when the batch is attempted (errors
 * per-sample are swallowed) — callers fire-and-forget.
 */
export async function flushTrainingSamples(): Promise<void> {
  if (!useSettingsStore.getState().settings.telemetryConsent) return; // opt-in only
  if (!auth.currentUser) return; // create rule requires an authed client

  const samples = takeSettledUnuploaded();
  for (const sample of samples) {
    try {
      await addDoc(collection(db, 'training_samples'), toTrainingSampleDoc(sample, CLIENT_VERSION));
      markUploaded(sample.sessionId); // local-only id; never uploaded
    } catch {
      // leave un-uploaded; retried on the next flush (best-effort egress)
    }
  }
}
