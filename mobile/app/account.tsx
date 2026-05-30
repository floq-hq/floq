/**
 * My Account sub-screen (pushed from the More tab). Avatar, editable display
 * name, read-only email + joined date, and Sign out. Reads users/{uid} via
 * useUserProfile + the live provider photo via useCurrentUser; saves through
 * updateDisplayName (Firestore + Auth sync) and invalidates the profile query.
 */
import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, ScreenHeader, Text, TextField } from '../components/ui';
import { useTheme } from '../theme';
import { signOut, useCurrentUser } from '../services/firebase';
import { updateDisplayName, useUserProfile } from '../services/firebase/userProfile';

/** "May 2026" from epoch-ms, or null if missing/pending. */
function joinedLabel(createdAt: number | null | undefined): string | null {
  if (createdAt == null) return null;
  return new Date(createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export default function AccountScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { data: profile } = useUserProfile();

  const name = profile?.displayName || user?.displayName || 'Floq user';
  const email = profile?.email || user?.email || '';
  const joined = joinedLabel(profile?.createdAt);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  function startEdit() {
    setDraft(name);
    setError(null);
    setEditing(true);
  }

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError('Name cannot be empty.');
      return;
    }
    if (!user?.uid) return;
    setSaving(true);
    setError(null);
    try {
      await updateDisplayName(user.uid, trimmed);
      await queryClient.invalidateQueries({ queryKey: ['user', 'profile', user.uid] });
      setEditing(false);
    } catch {
      setError("Couldn't save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace('/');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScreenHeader title="My account" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.identity}>
          <Avatar photoURL={user?.photoURL} name={name} size={88} />

          {editing ? (
            <View style={styles.editBox}>
              <TextField
                label="Display name"
                value={draft}
                onChangeText={setDraft}
                autoFocus
                autoCapitalize="words"
                maxLength={40}
                error={error ?? undefined}
                returnKeyType="done"
                onSubmitEditing={save}
              />
              <View style={styles.editActions}>
                <Button label="Cancel" variant="ghost" onPress={() => setEditing(false)} disabled={saving} />
                <Button label="Save" variant="primary" onPress={save} loading={saving} />
              </View>
            </View>
          ) : (
            <View style={styles.nameRow}>
              <Text variant="title">{name}</Text>
              <Button label="Edit" variant="ghost" onPress={startEdit} />
            </View>
          )}

          {!editing && (
            <View style={styles.meta}>
              {email ? (
                <Text variant="body" color={theme.textMuted}>
                  {email}
                </Text>
              ) : null}
              {joined ? (
                <Text variant="caption" color={theme.textMuted}>
                  {`Joined ${joined}`}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {!editing && (
          <Button label="Sign out" variant="secondary" loading={signingOut} onPress={onSignOut} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 24, paddingBottom: 32, gap: 32 },
  identity: { alignItems: 'center', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editBox: { alignSelf: 'stretch', gap: 12 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  meta: { alignItems: 'center', gap: 2 },
});
