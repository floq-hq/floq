/**
 * ProfileHeader — the tappable identity block at the top of the More tab:
 * avatar + name + email + chevron, pushing /account. Presentational only; reads
 * the profile (users/{uid}) + the live provider photo (useCurrentUser).
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Avatar, Text, ChevronRightIcon } from '../ui';
import { useTheme } from '../../theme';
import { useCurrentUser } from '../../services/firebase';
import { useUserProfile } from '../../services/firebase/userProfile';

export function ProfileHeader() {
  const theme = useTheme();
  const { user } = useCurrentUser();
  const { data: profile } = useUserProfile();

  const name = profile?.displayName || user?.displayName || 'Floq user';
  const email = profile?.email || user?.email || '';

  return (
    <Pressable
      onPress={() => router.push('/account')}
      accessibilityRole="button"
      accessibilityLabel={`Account: ${name}`}
      style={[styles.row, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}
    >
      <Avatar photoURL={user?.photoURL} name={name} size={56} />
      <View style={styles.text}>
        <Text variant="heading">{name}</Text>
        {email ? (
          <Text variant="caption" color={theme.textMuted}>
            {email}
          </Text>
        ) : null}
      </View>
      <ChevronRightIcon color={theme.textMuted} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  text: { flex: 1, gap: 2 },
});
