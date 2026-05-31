// App/timer settings (M3.4).
//
// First setting: the background-during-session policy (resolves decisions.md O4).
// Kept as a small, extensible blob so future user settings slot in beside it.

export type BackgroundPolicy =
  | 'forgiving' // >30s backgrounded during a session = 1 distraction (O4 default)
  | 'strict'; // any background during a session = 1 distraction

export const BACKGROUND_POLICIES: readonly BackgroundPolicy[] = ['forgiving', 'strict'];

/** Theme preference. 'system' follows the OS per-device; an explicit light/dark
 *  is a user choice that syncs across devices (lives in the settings blob). */
export type ThemeOverride = 'system' | 'light' | 'dark';
export const THEME_OVERRIDES: readonly ThemeOverride[] = ['system', 'light', 'dark'];

export interface Settings {
  backgroundPolicy: BackgroundPolicy;
  /** Theme override (S2 / appearance). 'system' default; explicit light/dark
   *  syncs cross-device. */
  themeOverride: ThemeOverride;
  /** L23: opt-in to share anonymized session data for ML training. Default OFF
   *  (opt-in, never opt-out). Gates the egress in services/telemetry — local
   *  capture (training_outbox) is unconditional; only UPLOAD is consent-gated. */
  telemetryConsent: boolean;
  /** Notification preferences (S4.2), default ON. Gate the schedulers in
   *  services/notifications — when off, the reminder is never scheduled and any
   *  pending one is cancelled. Flat booleans (not nested) so loadSettings's
   *  shallow merge fills each independently for blobs from an older build. */
  breakReminderEnabled: boolean;
  sessionStartReminderEnabled: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  backgroundPolicy: 'forgiving',
  themeOverride: 'system',
  telemetryConsent: false,
  breakReminderEnabled: true,
  sessionStartReminderEnabled: true,
};
