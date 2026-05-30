/**
 * Account section for the More tab: avatar (provider photo → initials fallback),
 * the display name with an inline edit, the read-only email + "joined" date, and
 * a privacy explainer.
 *
 * Data comes from useUserProfile() (the users/{uid} doc) paired with
 * useCurrentUser() for the live provider photoURL — no fetching in the screen
 * (mobile/CLAUDE.md). Saving a name calls updateDisplayName and invalidates the
 * profile query so the new name shows immediately.
 *
 * Privacy is shown READ-ONLY on purpose: the real partner-visibility consent is
 * pairing-time (W7), and the global privacy field gates no partner reads yet —
 * a live toggle here would control nothing, so it's an explainer for now.
 */
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Text, TextField } from '../ui';
import { useTheme } from '../../theme';
import { useCurrentUser } from '../../services/firebase';
import { updateDisplayName, useUserProfile } from '../../services/firebase/userProfile';

/** "May 2026" from epoch-ms, or null if the timestamp is missing/pending. */
function joinedLabel(createdAt: number | null): string | null {
  if (createdAt == null) return null;
  return new Date(createdAt).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export function ProfileSection() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { user } = useCurrentUser();
  const { data: profile } = useUserProfile();

  const name = profile?.displayName || user?.displayName || 'Floq user';
  const email = profile?.email || user?.email || '';
  const joined = joinedLabel(profile?.createdAt ?? null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <View style={styles.section}>
      <View style={styles.identity}>
        <Avatar photoURL={user?.photoURL} name={name} size={72} />

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
      </View>

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

      <View style={[styles.privacy, { borderColor: theme.border }]}>
        <Text variant="bodyMedium">Privacy</Text>
        <Text variant="caption" color={theme.textMuted} style={styles.privacyLine}>
          Your sessions and task names stay private to you. When you pair with a focus
          partner, you&apos;ll choose what they can see.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 20 },
  identity: { alignItems: 'center', gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  editBox: { alignSelf: 'stretch', gap: 12 },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  meta: { alignItems: 'center', gap: 2 },
  privacy: { gap: 4, padding: 16, borderRadius: 8, borderWidth: 1 },
  privacyLine: {},
});
