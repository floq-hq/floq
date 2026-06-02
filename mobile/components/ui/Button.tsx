/**
 * Button primitive. Three variants, two sizes.
 *
 *   primary   — filled accent, inverse text. The single CTA per screen.
 *   secondary — outlined (borderStrong), default text. Low-emphasis confirm.
 *   ghost     — no border, no fill, accent text. Tertiary actions.
 *
 * `disabled` dims and blocks press. `loading` swaps the label for a spinner and
 * blocks press. Radius 8 per the design system (buttons/cards = 8).
 */
import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useTheme } from '../../theme';
import type { Theme } from '../../theme/tokens';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'ghost';
type Size = 'lg' | 'md';

export type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

// S6.3 Dynamic Type: minHeight (not height) so the button grows instead of
// clipping the label at the largest text sizes; paddingVertical keeps the
// label off the edges as it scales.
const SIZE = {
  lg: { minHeight: 52, paddingHorizontal: 24, paddingVertical: 8, token: 'bodyMedium' as const },
  md: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 6, token: 'label' as const },
};

/** Resolves bg / border / text color for a variant, accounting for pressed state. */
function colorsFor(theme: Theme, variant: Variant, pressed: boolean) {
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: theme.accent,
        borderColor: theme.accent,
        textColor: theme.textInverse,
        opacity: pressed ? 0.85 : 1,
      };
    case 'secondary':
      return {
        backgroundColor: pressed ? theme.bgPressed : 'transparent',
        borderColor: theme.borderStrong,
        textColor: theme.text,
        opacity: 1,
      };
    case 'ghost':
      return {
        backgroundColor: pressed ? theme.bgPressed : 'transparent',
        borderColor: 'transparent',
        textColor: theme.accent,
        opacity: 1,
      };
  }
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const theme = useTheme();
  const dims = SIZE[size];
  const blocked = disabled || loading;

  const layout = useMemo<ViewStyle>(
    () => ({
      minHeight: dims.minHeight,
      paddingHorizontal: dims.paddingHorizontal,
      paddingVertical: dims.paddingVertical,
    }),
    [dims.minHeight, dims.paddingHorizontal, dims.paddingVertical],
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      onPress={onPress}
      disabled={blocked}
      style={({ pressed }) => {
        const c = colorsFor(theme, variant, pressed && !blocked);
        return [
          styles.base,
          layout,
          {
            backgroundColor: c.backgroundColor,
            borderColor: c.borderColor,
            opacity: disabled ? 0.4 : c.opacity,
          },
          style,
        ];
      }}
    >
      {/* Keep layout stable while loading: spinner overlays, label stays for width. */}
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator
            color={variant === 'primary' ? theme.textInverse : theme.accent}
          />
        </View>
      ) : null}
      <Text
        variant={dims.token}
        color={colorsFor(theme, variant, false).textColor}
        style={loading ? styles.hiddenLabel : undefined}
        numberOfLines={2}
        maxFontSizeMultiplier={1.6}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
  loadingWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  hiddenLabel: { opacity: 0 },
});
