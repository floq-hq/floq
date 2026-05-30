/**
 * Avatar — the user's picture, the free way (no Firebase Storage / Blaze).
 *
 *   1. `photoURL` present (Google/Apple provider photo) → render the image.
 *   2. otherwise → a themed circular monogram of the name's initials.
 *
 * Custom photo upload is deferred (it needs the paid Cloud Storage tier), so
 * there is no upload affordance and no `photo_url` schema field — the provider
 * URL is just a hosted link, and the initials fallback covers email/password
 * users who have no provider photo.
 */
import { Image, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { useTheme } from '../../theme';
import { initialsFromName } from './avatarInitials';

export interface AvatarProps {
  /** Provider photo URL (e.g. Google/Apple). Null/undefined → initials fallback. */
  photoURL?: string | null;
  /** Display name — source of the initials fallback. */
  name: string;
  /** Diameter in px. Default 64. */
  size?: number;
}

export function Avatar({ photoURL, name, size = 64 }: AvatarProps) {
  const theme = useTheme();
  const dimension = { width: size, height: size, borderRadius: size / 2 };

  if (photoURL) {
    return (
      <Image
        source={{ uri: photoURL }}
        style={[dimension, { backgroundColor: theme.bgElevated }]}
        accessibilityRole="image"
        accessibilityLabel={`${name}'s photo`}
      />
    );
  }

  return (
    <View
      style={[styles.monogram, dimension, { backgroundColor: theme.accentMuted }]}
      accessibilityRole="image"
      accessibilityLabel={`${name}'s initials`}
    >
      <Text variant="title" color={theme.accent} style={{ fontSize: size * 0.4 }}>
        {initialsFromName(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  monogram: { alignItems: 'center', justifyContent: 'center' },
});
