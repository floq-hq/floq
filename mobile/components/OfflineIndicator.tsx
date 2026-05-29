/**
 * OfflineIndicator (S4.3) — small "Offline" pill that renders only when the
 * device is offline; null otherwise. Calm by design: a danger-tinted dot + a
 * muted caption, no banner, no animation, no nag. Cached data stays usable
 * (everything reads MMKV / SQLite first), this just signals freshness.
 *
 * Drop wherever a screen reads server-backed or sync-mirrored data — Home and
 * Stats today.
 */
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from './ui';
import { useTheme } from '../theme';
import { useIsOnline } from '../services/network/useOnline';

export function OfflineIndicator({ style }: { style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const online = useIsOnline();
  if (online) return null;

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel="Offline"
      style={[
        styles.pill,
        { backgroundColor: theme.bgElevated, borderColor: theme.border },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: theme.danger }]} />
      <Text variant="caption" color={theme.textMuted}>
        Offline
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
