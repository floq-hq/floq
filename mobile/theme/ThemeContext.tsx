/**
 * Theme provider + override store.
 *
 * Boot order (per `shared/spec/design-system.md`):
 *   1. Read `floq.theme_override` from MMKV synchronously on first render.
 *      MMKV is sync, so the very first paint already has the correct theme —
 *      no flash of the wrong theme. (AsyncStorage would flash; do not use it.)
 *   2. override === 'system' → follow `useColorScheme()` live.
 *   3. override === 'light' | 'dark' → use that, ignore `useColorScheme()`.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import { createMMKV } from 'react-native-mmkv';
import { darkTheme, lightTheme, type Theme } from './tokens';

export type ThemeOverride = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'floq.theme_override';
const storage = createMMKV();

function readOverride(): ThemeOverride {
  const stored = storage.getString(STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

type ThemeContextValue = {
  theme: Theme;
  scheme: 'light' | 'dark';
  override: ThemeOverride;
  setOverride: (next: ThemeOverride) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Sync read on first render — no flash of wrong theme.
  const [override, setOverrideState] = useState<ThemeOverride>(readOverride);
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null

  const scheme: 'light' | 'dark' =
    override === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : override;

  const setOverride = useCallback((next: ThemeOverride) => {
    storage.set(STORAGE_KEY, next);
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
