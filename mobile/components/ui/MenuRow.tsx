/**
 * MenuRow — the WHOOP-style settings/menu row: leading icon + short bold label +
 * optional one-line subtitle (the value, not instructions) + trailing chevron.
 * Tapping pushes a focused sub-screen. Grouped-card styling matches the option
 * rows in BackgroundPolicySetting so the whole settings surface reads uniform.
 *
 * `disabled` dims the row and drops the chevron (used for the "Soon" Tutorials
 * slot — visible structure, no dead-end navigation). `badge` renders a quiet
 * trailing tag (e.g. "Soon").
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Pill } from './Pill';
import { ChevronRightIcon, type IconProps } from './icons';
import { useTheme } from '../../theme';

export interface MenuRowProps {
  Icon?: React.FC<IconProps>;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  disabled?: boolean;
  badge?: string;
}

export function MenuRow({ Icon, label, subtitle, onPress, disabled, badge }: MenuRowProps) {
  const theme = useTheme();
  const fg = disabled ? theme.textMuted : theme.text;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      accessibilityLabel={subtitle ? `${label}. ${subtitle}` : label}
      style={[
        styles.row,
        { backgroundColor: theme.bgElevated, borderColor: theme.border, opacity: disabled ? 0.55 : 1 },
      ]}
    >
      {Icon ? (
        <View style={styles.icon}>
          <Icon color={theme.textMuted} size={22} />
        </View>
      ) : null}

      <View style={styles.text}>
        <Text variant="bodyMedium" color={fg}>
          {label}
        </Text>
        {subtitle ? (
          <Text variant="caption" color={theme.textMuted}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {badge ? (
        <Pill label={badge} color={theme.textMuted} variant="subtle" size="label" uppercase />
      ) : !disabled ? (
        <ChevronRightIcon color={theme.textMuted} size={20} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  icon: { width: 24, alignItems: 'center' },
  text: { flex: 1, gap: 2 },
});
