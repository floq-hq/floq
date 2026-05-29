// Dev-only forecast mock (S5.2 acceptance: "mock-test by manually setting
// sessionsCompleted in dev tools"). Lets the /dev harness force the Stats
// forecast section into cold / warming / mature without logging 7–14 real
// sessions.
//
// DEV ONLY. The store is always defined (cheap, inert), but ForecastSection
// reads it solely under `__DEV__`, so production builds never branch on it.
// MMKV-backed so the chosen state survives a Metro reload (the natural way to
// force a refetch), following the house pattern: plain Zustand + explicit MMKV,
// no persist middleware (see stores/useOnboardingStore.ts).

import { create } from 'zustand';
import { createMMKV } from 'react-native-mmkv';

const STORAGE_KEY = 'floq.dev.forecast_sessions';
const storage = createMMKV();

function readOverride(): number | null {
  const stored = storage.getNumber(STORAGE_KEY);
  return typeof stored === 'number' ? stored : null;
}

interface DevForecastState {
  /** Forced lifetime session count, or null when the override is off (the app
   *  uses the real session count). */
  sessionsOverride: number | null;
  /** Set the forced count (persists), or pass null to turn the override off. */
  setSessionsOverride: (n: number | null) => void;
}

export const useDevForecastOverride = create<DevForecastState>((set) => ({
  sessionsOverride: readOverride(),
  setSessionsOverride: (n) => {
    if (n == null) storage.remove(STORAGE_KEY);
    else storage.set(STORAGE_KEY, n);
    set({ sessionsOverride: n });
  },
}));
