// App/timer settings (M3.4).
//
// First setting: the background-during-session policy (resolves decisions.md O4).
// Kept as a small, extensible blob so future user settings slot in beside it.

export type BackgroundPolicy =
  | 'forgiving' // >30s backgrounded during a session = 1 distraction (O4 default)
  | 'strict'; // any background during a session = 1 distraction

export const BACKGROUND_POLICIES: readonly BackgroundPolicy[] = ['forgiving', 'strict'];

export interface Settings {
  backgroundPolicy: BackgroundPolicy;
  /** L23: opt-in to share anonymized session data for ML training. Default OFF
   *  (opt-in, never opt-out). Gates the egress in services/telemetry — local
   *  capture (training_outbox) is unconditional; only UPLOAD is consent-gated. */
  telemetryConsent: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  backgroundPolicy: 'forgiving',
  telemetryConsent: false,
};
