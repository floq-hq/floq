// Settings persistence (M3.4).
//
// One atomic MMKV blob under `floq.settings` (mirrors services/tasks/persist.ts).
// load merges over DEFAULT_SETTINGS so a blob written by an older build (missing
// a newer key) still returns a complete object, and coerces an unrecognized
// backgroundPolicy back to the default. Sync, React-free.

import { createMMKV } from 'react-native-mmkv';
import { BACKGROUND_POLICIES, DEFAULT_SETTINGS, type Settings } from './types';

export const SETTINGS_KEY = 'floq.settings';

const storage = createMMKV();

/** Persist the settings blob atomically. Synchronous. */
export function saveSettings(settings: Settings): void {
  storage.set(SETTINGS_KEY, JSON.stringify(settings));
}

/** Read settings. Returns DEFAULT_SETTINGS on a fresh install or a
 *  corrupt/partial blob, with any unknown backgroundPolicy coerced to default. */
export function loadSettings(): Settings {
  const raw = storage.getString(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_SETTINGS };
    const merged: Settings = { ...DEFAULT_SETTINGS, ...parsed };
    if (!BACKGROUND_POLICIES.includes(merged.backgroundPolicy)) {
      merged.backgroundPolicy = DEFAULT_SETTINGS.backgroundPolicy;
    }
    return merged;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Clear persisted settings (store reset). */
export function clearSettings(): void {
  storage.remove(SETTINGS_KEY);
}
