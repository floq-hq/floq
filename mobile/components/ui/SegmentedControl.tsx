/**
 * Segmented control. Used for the onboarding Q2/Q3/Q4 single-choice questions.
 *
 * Selected segment → accent fill + inverse text. Unselected → transparent on the
 * `bgElevated` container, default text. One container border (borderStrong),
 * radius 8, with 1px dividers between segments.
 *
 * Generic over the value type so callers get type-safe `value` / `onChange`.
 */
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from './Text';

export type SegmentedControlOption<T> = { label: string; value: T };

export type SegmentedControlProps<T> = {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  style,
}: SegmentedControlProps<T>) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.bgElevated, borderColor: theme.borderStrong },
        style,
      ]}
    >
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(opt.value)}
            style={[
              styles.segment,
              { backgroundColor: selected ? theme.accent : 'transparent' },
              i > 0 ? { borderLeftWidth: 1, borderLeftColor: theme.borderStrong } : null,
            ]}
          >
            <Text
              variant="label"
              color={selected ? theme.textInverse : theme.text}
              numberOfLines={1}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
});
