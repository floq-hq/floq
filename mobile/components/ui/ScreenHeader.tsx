/**
 * ScreenHeader — back chevron + title for pushed sub-screens. The app's Stack
 * is headerless (app/_layout.tsx: headerShown: false), so screens render their
 * own. Back defaults to router.back(); override via `onBack`.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { BackIcon } from './icons';
import { useTheme } from '../../theme';

export function ScreenHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={styles.back}
      >
        <BackIcon color={theme.text} size={24} />
      </Pressable>
      <Text variant="title">{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  back: { marginLeft: -4 },
});
