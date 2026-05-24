/**
 * Themed text primitive. Every piece of text in the app goes through this so
 * the type scale and theme color are applied consistently — never raw RN
 * `<Text>` with ad-hoc fontSize/color.
 *
 * `variant` is required (maps to a `shared/spec/design-system.md` type token).
 * `color` overrides the default `theme.text`; pass a theme token, never raw hex
 * (e.g. `color={theme.textMuted}`).
 */
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '../../theme';
import { getTextStyle, type TypographyToken } from '../../theme/typography';

export type TextProps = RNTextProps & {
  variant: TypographyToken;
  color?: string;
};

export function Text({ variant, color, style, ...rest }: TextProps) {
  const theme = useTheme();
  const base = getTextStyle(variant, theme);
  return <RNText {...rest} style={[base, color ? { color } : null, style]} />;
}
