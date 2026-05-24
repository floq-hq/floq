/**
 * Pill primitive. Full-rounded (radius 9999). Two variants:
 *
 *   solid  — colored background, inverse (white) text. Difficulty tags etc.
 *   subtle — background = color at 12% alpha, text = color at full opacity.
 *            This is exactly the phase-indicator rule from the design system.
 *
 * `dot` adds a ~6px leading dot in the text color — the phase indicator's
 * presence marker (not a status light; no pulsing). `uppercase` applies the
 * +0.5 letter-spacing the spec specifies for uppercase labels.
 */
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from './Text';
import type { TypographyToken } from '../../theme/typography';

type Variant = 'solid' | 'subtle';

export type PillProps = {
  label: string;
  /** Base color — pass a theme token (e.g. `theme.phase.flow`), never raw hex. */
  color: string;
  variant?: Variant;
  dot?: boolean;
  uppercase?: boolean;
  size?: Extract<TypographyToken, 'tiny' | 'label'>;
  style?: StyleProp<ViewStyle>;
};

/**
 * Appends an alpha channel to a #RGB / #RRGGBB color. Strips any existing alpha
 * first so callers can pass either form. `alpha` is 0–1.
 */
function withAlpha(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const rgb = h.slice(0, 6);
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${rgb}${a}`;
}

export function Pill({
  label,
  color,
  variant = 'subtle',
  dot = false,
  uppercase = false,
  size = 'label',
  style,
}: PillProps) {
  const theme = useTheme();
  const backgroundColor = variant === 'solid' ? color : withAlpha(color, 0.12);
  const textColor = variant === 'solid' ? theme.textInverse : color;

  return (
    <View style={[styles.base, { backgroundColor }, style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: textColor }]} /> : null}
      <Text
        variant={size}
        color={textColor}
        style={uppercase ? styles.uppercase : undefined}
        numberOfLines={1}
      >
        {uppercase ? label.toUpperCase() : label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 9999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  uppercase: { letterSpacing: 0.5 },
});
