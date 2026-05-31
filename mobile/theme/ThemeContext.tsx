/**
 * Theme provider + override store.
 *
 * The theme override now lives in the synced settings blob (services/settings) so
 * an explicit light/dark choice follows the user across devices (useSettingsSync).
 * Boot order (per `shared/spec/design-system.md`):
 *   1. Read the override from MMKV synchronously on first render via
 *      `loadSettings()` (MMKV is sync → the very first paint has the correct theme,
 *      no flash; AsyncStorage would flash, do not use it). A legacy
 *      `floq.theme_override` key is migrated by loadSettings.
 *   2. After the settings store hydrates / a cross-device pull arrives, follow the
 *      store's value.
 *   3. override === 'system' → follow `useColorScheme()` live; 'light'|'dark' → use
 *      that, ignore the OS.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import { useSettingsStore } from '../stores/useSettingsStore';
import { loadSettings } from '../services/settings/persist';
import { type ThemeOverride } from '../services/settings/types';
import { darkTheme, lightTheme, type Theme } from './tokens';

export type { ThemeOverride };

type ThemeContextValue = {
  theme: Theme;
  scheme: 'light' | 'dark';
  override: ThemeOverride;
  setOverride: (next: ThemeOverride) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Sync read on first render — no flash. After the store hydrates (boot) or a
  // cross-device pull lands, follow the store's value.
  const [override, setOverrideState] = useState<ThemeOverride>(() => loadSettings().themeOverride);
  const storeHydrated = useSettingsStore((s) => s.hydrated);
  const storeOverride = useSettingsStore((s) => s.settings.themeOverride);
  useEffect(() => {
    if (storeHydrated) setOverrideState(storeOverride);
  }, [storeHydrated, storeOverride]);

  const systemScheme = useColorScheme(); // 'light' | 'dark' | null

  const scheme: 'light' | 'dark' =
    override === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : override;

  const setOverride = useCallback((next: ThemeOverride) => {
    // Persist through the store → settings blob → cross-device mirror. Update
    // local state immediately for instant feedback (the store change echoes here).
    useSettingsStore.getState().setThemeOverride(next);
    setOverrideState(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: scheme === 'dark' ? darkTheme : lightTheme,
      scheme,
      override,
      setOverride,
    }),
    [scheme, override, setOverride],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme / useThemeSettings must be used within <ThemeProvider>');
  }
  return ctx;
}

/** Internal accessor used by `useTheme`. */
export function useActiveTheme(): Theme {
  return useThemeContext().theme;
}

/**
 * Theme controls for the Settings screen: current resolved scheme, the stored
 * override, and a setter that persists to MMKV.
 */
export function useThemeSettings() {
  const { scheme, override, setOverride } = useThemeContext();
  return { scheme, override, setOverride };
}
