// Settings persistence (M3.4; cross-device sync added W6-sweep).
//
// One atomic MMKV blob under `floq.settings` (mirrors services/tasks/persist.ts),
// PLUS a `floq.settings.updatedAt` last-write-wins clock. load merges over
// DEFAULT_SETTINGS so a blob written by an older build (missing a newer key) still
// returns a complete object, and coerces an unrecognized backgroundPolicy back to
// the default. Settings sync account-wide (incl. telemetryConsent — supersedes the
// L23 per-device note): saveSettings fires the async Firestore mirror + bumps the
// LWW clock; applyRemoteSettings is the no-mirror pull-down path. Sync, React-free.

import { createMMKV } from 'react-native-mmkv';
import { mirrorSettings } from './firestoreMirror';
import {
  BACKGROUND_POLICIES,
  DEFAULT_SETTINGS,
  THEME_OVERRIDES,
  type Settings,
} from './types';

export const SETTINGS_KEY = 'floq.settings';
/** Legacy pre-settings-blob theme key (theme/ThemeContext used its own MMKV).
 *  Migrated into the blob on load so an existing user keeps their theme choice. */
const LEGACY_THEME_KEY = 'floq.theme_override';
/** Last-write-wins clock: epoch ms of whatever settings version lives locally.
 *  Bumped on a local save; set to the remote's server ms when a newer remote blob
 *  is adopted (settingsSync). */
export const SETTINGS_UPDATED_AT_KEY = 'floq.settings.updatedAt';

const storage = createMMKV();

/** Merge an unknown parsed value over the defaults + coerce backgroundPolicy.
 *  Shared by loadSettings (MMKV) and the remote pull (settingsSync) so a blob from
 *  either source is always complete + valid. */
export function coerceSettings(parsed: unknown): Settings {
  if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
  const merged: Settings = { ...DEFAULT_SETTINGS, ...(parsed as Partial<Settings>) };
  if (!BACKGROUND_POLICIES.includes(merged.backgroundPolicy)) {
    merged.backgroundPolicy = DEFAULT_SETTINGS.backgroundPolicy;
  }
  if (!THEME_OVERRIDES.includes(merged.themeOverride)) {
    merged.themeOverride = DEFAULT_SETTINGS.themeOverride;
  }
  merged.telemetryConsent = Boolean(merged.telemetryConsent);
  merged.breakReminderEnabled = Boolean(merged.breakReminderEnabled);
  merged.sessionStartReminderEnabled = Boolean(merged.sessionStartReminderEnabled);
  return merged;
}

function writeCache(settings: Settings): void {
  storage.set(SETTINGS_KEY, JSON.stringify(settings));
}

/** Persist the settings blob: cache it, bump the LWW clock, and fire the async
 *  Firestore mirror (fire-and-forget — a failed mirror never loses the local write
 *  or surfaces; reconciles on the next signed-in sync). Synchronous. */
export function saveSettings(settings: Settings): void {
  writeCache(settings);
  saveSettingsUpdatedAt(Date.now());
  void mirrorSettings(settings).catch(() => {
    // swallowed: MMKV holds the truth; reconcile on a later signed-in sync.
  });
}

/** Read settings. Returns DEFAULT_SETTINGS on a fresh install or a
 *  corrupt/partial blob, with any unknown backgroundPolicy coerced to default. */
export function loadSettings(): Settings {
  const raw = storage.getString(SETTINGS_KEY);
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  const merged = coerceSettings(parsed);
  // One-time migration: a blob that never carried a themeOverride inherits the
  // legacy `floq.theme_override` key (written by the old ThemeContext) so an
  // existing user's explicit light/dark choice isn't reset to 'system'.
  if (!parsed || (parsed as Record<string, unknown>).themeOverride === undefined) {
    const legacy = storage.getString(LEGACY_THEME_KEY);
    if (legacy === 'light' || legacy === 'dark' || legacy === 'system') {
      merged.themeOverride = legacy;
    }
  }
  return merged;
}

/** Read the local settings LWW clock (epoch ms; 0 if never set). */
export function loadSettingsUpdatedAt(): number {
  return storage.getNumber(SETTINGS_UPDATED_AT_KEY) ?? 0;
}

/** Set the local settings LWW clock. */
export function saveSettingsUpdatedAt(ms: number): void {
  storage.set(SETTINGS_UPDATED_AT_KEY, ms);
}

/** Apply a remote settings blob pulled by settingsSync — cache + LWW clock,
 *  WITHOUT firing the mirror (the data came FROM Firestore; re-mirroring would
 *  loop). Used only by the pull-down when the remote is newer. */
export function applyRemoteSettings(settings: Settings, updatedAtMs: number): void {
  writeCache(settings);
  saveSettingsUpdatedAt(updatedAtMs);
}

/** Clear persisted settings + the LWW clock (store reset / sign-out). */
export function clearSettings(): void {
  storage.remove(SETTINGS_KEY);
  storage.remove(SETTINGS_UPDATED_AT_KEY);
}
