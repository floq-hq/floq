/**
 * Your data sub-screen — "what we collect" + a full Clear-history action.
 *
 * Clear is a REAL wipe (local + your Firestore mirror), because a local-only
 * clear can't stick: the sync listeners (useSessionSync/useTaskSync) just
 * re-import the cloud copy. So it deletes users/{uid}/sessions + /tasks AND the
 * local SQLite/MMKV, then refreshes stats. Anonymized `training_samples` are NOT
 * deleted — they're unlinkable by design (L23).
 *
 * Undo: the destructive op is DEFERRED behind a few-second floating toast. Tapping
 * Clear starts the window and shows "Undo"; the wipe only commits when the window
 * elapses, so an accidental tap is fully reversible (nothing is deleted yet).
 * Leaving the screen cancels a pending clear (conservative for a destructive op).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ScreenHeader, Text } from '../components/ui';
import { useTheme } from '../theme';
import { useCurrentUser } from '../services/firebase';
import { wipeRemoteUserData } from '../services/firebase/userData';
import { deleteAllSessions } from '../services/storage/sessions';
import { deleteAllTrainingSamples } from '../services/storage/trainingOutbox';
import { useTaskStore } from '../stores/useTaskStore';
import { queryClient } from '../services/queryClient';
import { statsKeys } from '../services/stats/useStats';

/** How long the floating Undo stays before the wipe commits. */
const UNDO_MS = 5000;

function Card({ title, body }: { title: string; body: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
      <Text variant="bodyMedium">{title}</Text>
      <Text variant="body" color={theme.textMuted}>
        {body}
      </Text>
    </View>
  );
}

export default function DataScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useCurrentUser();

  const [pending, setPending] = useState(false); // undo window open
  const [busy, setBusy] = useState(false); // wipe in progress
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Leaving the screen cancels a pending clear — nothing is deleted until the
  // window commits, so leaving is a safe no-op (conservative for a destructive op).
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const commit = useCallback(async () => {
    timerRef.current = null;
    setPending(false);
    setBusy(true);
    setError(null);
    try {
      // Delete the cloud mirror FIRST so the next sync snapshot is empty and
      // nothing resurrects; then clear local. Signed out → local-only is fine
      // (no mirror to re-import).
      if (user?.uid) await wipeRemoteUserData(user.uid);
      deleteAllSessions();
      deleteAllTrainingSamples();
      useTaskStore.getState().reset();
      await queryClient.invalidateQueries({ queryKey: statsKeys.all });
    } catch {
      setError('Couldn’t clear your data — check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }, [user]);

  function startClear() {
    if (pending || busy) return;
    setError(null);
    setPending(true);
    timerRef.current = setTimeout(() => void commit(), UNDO_MS);
  }

  function undo() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setPending(false);
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScreenHeader title="Your data" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Card
          title="Your focus data"
          body="Your sessions, focus scores, streaks, and task names live on your device and sync across your own devices when you’re signed in."
        />
        <Card
          title="What you can share"
          body="If you turn on “Help improve Floq” in Privacy & data, anonymized session metrics (never task names) are shared to improve the timer. It’s off by default."
        />
        <Card
          title="Already-shared data"
          body="Shared data is anonymous and can’t be traced back to you — so it can’t be deleted. Turning sharing off stops future sessions from being shared."
        />

        <View style={styles.action}>
          <Button
            label="Clear history"
            variant="secondary"
            loading={busy}
            disabled={pending}
            onPress={startClear}
          />
          <Text variant="caption" color={theme.textMuted} style={styles.actionNote}>
            Permanently deletes your sessions, stats, and tasks — on this device and your
            other devices. If you have a focus partner, it also ends that partnership.
            Anonymized shared data isn’t affected.
          </Text>
          {error ? (
            <Text variant="caption" color={theme.danger} style={styles.actionNote}>
              {error}
            </Text>
          ) : null}
        </View>
      </ScrollView>

      {/* Floating undo toast — the few-second grace before the wipe commits. */}
      {pending ? (
        <View style={[styles.toastWrap, { bottom: insets.bottom + 24 }]} pointerEvents="box-none">
          <View style={[styles.toast, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
            <Text variant="body" style={styles.toastText}>
              Clearing your history…
            </Text>
            <Pressable
              onPress={undo}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Undo clearing history"
            >
              <Text variant="bodyMedium" color={theme.accent}>
                Undo
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: 24, paddingBottom: 32, gap: 12 },
  card: { gap: 6, padding: 16, borderRadius: 8, borderWidth: 1 },
  action: { marginTop: 12, gap: 8 },
  actionNote: { textAlign: 'center' },
  toastWrap: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: 'stretch',
  },
  toastText: { flex: 1 },
});
