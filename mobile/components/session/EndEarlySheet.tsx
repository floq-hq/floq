/**
 * End-early sheet (M4.8 / L16) — the Save / Discard prompt shown when the user
 * taps "End early / I stopped" on `/focus`. One confirm step; ends the session
 * either way (it is a *termination*, not a pause — L16). The task stays in the
 * queue in both branches.
 *
 * Save  → useActiveSessionStore.abandonSession() (writes a completed:false
 *         partial via the finalize pipeline; real focus score)
 * Discard → resolveRestore('discard') equivalent — clear the in-flight mirror
 *         + reset the store; no SQLite write
 *
 * Both routes back to /home (no recovery break is enforced — it wasn't a
 * completed focus session). The summary screen is NOT shown for partials —
 * end-early is a quiet exit, not a celebration.
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '../ui';
import { clearActiveSession } from '../../services/session/activeSessionPersist';
import { queryClient } from '../../services/queryClient';
import { statsKeys } from '../../services/stats/useStats';
import { useActiveSessionStore } from '../../stores/useActiveSessionStore';
import { useTheme } from '../../theme';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export function EndEarlySheet({ visible, onDismiss }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const abandonSession = useActiveSessionStore((s) => s.abandonSession);
  const reset = useActiveSessionStore((s) => s.reset);
  const [busy, setBusy] = useState(false);
  // PR4 (audit Finding #5): show a brief inline confirmation before routing
  // home so the user knows the partial was saved. ~800ms is long enough to
  // read, short enough to not feel like a loading spinner.
  const [saved, setSaved] = useState<{ minutes: number } | null>(null);

  function exitToHome() {
    onDismiss();
    router.replace('/home');
  }

  function onSave() {
    setBusy(true);
    let partialMinutes = 0;
    try {
      const partial = abandonSession(); // writes completed:false partial; clears the mirror
      partialMinutes = partial?.actualFocusMinutes ?? 0;
      // Mirror the DONE wiring (focus.tsx onDone): refresh Stats immediately
      // so a tab-switch right after Save shows the partial, not stale numbers.
      queryClient.invalidateQueries({ queryKey: statsKeys.all });
    } finally {
      setBusy(false);
    }
    setSaved({ minutes: partialMinutes });
    setTimeout(exitToHome, 800);
  }

  function onDiscard() {
    // No SQLite write. Mirror cleared + store reset so the next launch is clean.
    clearActiveSession();
    reset();
    exitToHome();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable
        style={styles.scrim}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        {/* Stop the inner tap from dismissing the sheet. */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.bgElevated,
              borderColor: theme.border,
              marginBottom: insets.bottom + 16,
            },
          ]}
        >
          {saved ? (
            <>
              <Text variant="heading" style={styles.title}>
                Saved
              </Text>
              <Text variant="body" color={theme.textMuted} style={styles.body}>
                {`${saved.minutes} min focused · counted toward your stats and streak. Task stays in your queue.`}
              </Text>
            </>
          ) : (
            <>
              <Text variant="heading" style={styles.title}>
                Stop this session?
              </Text>
              <Text variant="body" color={theme.textMuted} style={styles.body}>
                You can save what you've focused so far — the time counts toward your
                stats and streak. Discarding ends the session without a record. The
                task stays in your queue either way.
              </Text>

              <View style={styles.actions}>
                <Button label="Save progress" onPress={onSave} loading={busy} />
                <Button label="Discard" variant="secondary" onPress={onDiscard} />
                <Button label="Cancel" variant="ghost" onPress={onDismiss} />
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Translucent backdrop — no dedicated `scrim` token in the design system, and
  // a half-black overlay is the platform-typical sheet-modal treatment.
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  title: {},
  body: {},
  actions: { gap: 8, marginTop: 4 },
});
