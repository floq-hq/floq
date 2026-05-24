import { useActiveTheme } from './ThemeContext';
import type { Theme } from './tokens';

/**
 * Returns the active token set for the current theme. This is the hook
 * components use for colors:
 *
 *   const theme = useTheme();
 *   <View style={{ backgroundColor: theme.bg }} />
 *
 * For reading/changing the override (Settings screen), use `useThemeSettings`.
 */
export function useTheme(): Theme {
  return useActiveTheme();
}
