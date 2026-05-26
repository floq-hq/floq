// Settings store (M3.4) — the reactive facade over persisted app settings.
//
// House pattern (see useTaskStore): plain Zustand, no persist middleware;
// write-through to services/settings/persist on every change; hydrate() on app
// launch; reset() for sign-out teardown. The S3.5 background-policy picker binds
// to this store. The store imports the persist service; never the reverse.

import { create } from 'zustand';
import { clearSettings, loadSettings, saveSettings } from '../services/settings/persist';
import { DEFAULT_SETTINGS, type BackgroundPolicy, type Settings } from '../services/settings/types';

interface SettingsState {
  settings: Settings;
  hydrated: boolean;

  hydrate: () => void;
  setBackgroundPolicy: (policy: BackgroundPolicy) => void;
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

    reset: () => {
      clearSettings();
      set({ settings: DEFAULT_SETTINGS, hydrated: false });
    },
  };
});
