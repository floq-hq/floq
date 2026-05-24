/**
 * Card primitive. `bgElevated` surface, 8px radius, single 1px `border`.
 *
 * Flat by default — one 1px border is the maximum "lift" allowed (design
 * system). The optional `elevated` prop adds the *only* shadow the spec
 * permits, and only for floating surfaces like modals:
 *   shadowOpacity 0.05, shadowRadius 12, shadowOffset { 0, 2 }.
 */
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { ReactNode } from 'react';
import { useTheme } from '../../theme';

export type CardProps = {
  children: ReactNode;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, elevated = false, style }: CardProps) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: theme.bgElevated, borderColor: theme.border },
        elevated ? styles.elevated : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
  },
  // The single allowed elevation shadow (design-system.md). iOS uses the shadow*
  // props; Android needs `elevation`. shadowColor stays black — opacity carries it.
  elevated: {
    shadowColor: '#000000',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
