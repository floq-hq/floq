// Settings store (M3.4) — the reactive facade over persisted app settings.
//
// House pattern (see useTaskStore): plain Zustand, no persist middleware;
// write-through to services/settings/persist on every change; hydrate() on app
// launch; reset() for sign-out teardown. The S3.5 background-policy picker binds
// to this store. The store imports the persist service; never the reverse.

import { create } from 'zustand';
import {
  applyRemoteSettings,
  clearSettings,
  loadSettings,
  saveSettings,
} from '../services/settings/persist';
import { DEFAULT_SETTINGS, type BackgroundPolicy, type Settings } from '../services/settings/types';

interface SettingsState {
  settings: Settings;
  hydrated: boolean;

  hydrate: () => void;
  setBackgroundPolicy: (policy: BackgroundPolicy) => void;
  setTelemetryConsent: (consent: boolean) => void;
  setBreakReminderEnabled: (enabled: boolean) => void;
  setSessionStartReminderEnabled: (enabled: boolean) => void;
  /** Adopt a settings blob pulled from another device (settingsSync) — persists
   *  via the no-mirror path so it doesn't loop back up. */
  applyRemote: (settings: Settings, updatedAtMs: number) => void;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => {
  const commit = (next: Settings) => {
    saveSettings(next);
    set({ settings: next });
  };

  return {
    settings: DEFAULT_SETTINGS,
    hydrated: false,

    hydrate: () => set({ settings: loadSettings(), hydrated: true }),

    setBackgroundPolicy: (policy) => commit({ ...get().settings, backgroundPolicy: policy }),
    setTelemetryConsent: (consent) => commit({ ...get().settings, telemetryConsent: consent }),
    setBreakReminderEnabled: (enabled) =>
      commit({ ...get().settings, breakReminderEnabled: enabled }),
    setSessionStartReminderEnabled: (enabled) =>
      commit({ ...get().settings, sessionStartReminderEnabled: enabled }),

    applyRemote: (settings, updatedAtMs) => {
      applyRemoteSettings(settings, updatedAtMs);
      set({ settings, hydrated: true });
    },

    reset: () => {
      clearSettings();
      set({ settings: DEFAULT_SETTINGS, hydrated: false });
    },
  };
});
