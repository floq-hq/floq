/**
 * Launch-time restore prompt (M4.8 / L16) — shown when `getRestorableSession()`
 * returns a non-null dangling session on app launch. Resume / Save / Discard.
 *
 *   Resume  → re-enter /focus with the dangling session's taskId + plan; the
 *             active-session store rehydrates the in-flight state, clock keeps
 *             wall-clock-correct elapsed.
 *   Save    → write a completed:false partial via the M4.5 restore pipeline,
 *             clear the mirror, fall through to Home.
 *   Discard → clear the mirror only, fall through to Home.
 *
 * Mounted by app/index.tsx ahead of the auth/onboarding/home redirect — the
 * prompt holds the redirect until the user picks. Solo / partner flows don't
 * matter at this stage; we only need a route after the user decides.
 */
import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '../ui';
import { resolveRestore } from '../../services/session/restore';
import { useActiveSessionStore } from '../../stores/useActiveSessionStore';
import type { ActiveSession } from '../../services/session/types';
import { useTheme } from '../../theme';

interface Props {
  /** The dangling session (from getRestorableSession). */
  session: ActiveSession;
  /** Called after the user picks an action — caller continues with the post-restore route. */
  onResolved: () => void;
}

function elapsedMinutes(startedAt: number): number {
  return Math.max(0, Math.round((Date.now() - startedAt) / 60_000));
}

export function RestoreSessionPrompt({ session, onResolved }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const reset = useActiveSessionStore((s) => s.reset);
  const [busy, setBusy] = useState<'resume' | 'save' | 'discard' | null>(null);

  const focusedSoFar = elapsedMinutes(session.startedAt);

  function onResume() {
    setBusy('resume');
    // Routing into /focus with the same plan re-enters the in-flight session;
    // the screen reads the existing active session from the store on mount.
    router.replace({
      pathname: '/focus',
      params: {
        taskId: session.taskId,
        plan: JSON.stringify(session.plan),
      },
    });
    onResolved();
  }

  function onSave() {
    setBusy('save');
    try {
      resolveRestore('save'); // writes completed:false partial + clears MMKV
      reset(); // store back to a clean state for the next session
    } finally {
      setBusy(null);
    }
    onResolved();
  }

  function onDiscard() {
    setBusy('discard');
    try {
      resolveRestore('discard'); // clears MMKV; no SQLite write
      reset();
    } finally {
      setBusy(null);
    }
    onResolved();
  }

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen">
      <View
        style={[
          styles.root,
          {
            backgroundColor: theme.bg,
            paddingTop: insets.top + 32,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <View style={styles.body}>
          <Text variant="heading" color={theme.textMuted}>
            Pick up where you left off?
          </Text>
          <Text variant="title" style={styles.title} numberOfLines={3}>
            {session.task.title}
          </Text>
          <Text variant="body" color={theme.textMuted} style={styles.context}>
            {focusedSoFar} min focused so far · {session.distractions.length}{' '}
            distraction{session.distractions.length === 1 ? '' : 's'}
          </Text>
        </View>

        <View style={styles.actions}>
          <Button
            label="Resume session"
            onPress={onResume}
            loading={busy === 'resume'}
          />
          <Button
            label="Save progress"
            variant="secondary"
            onPress={onSave}
            loading={busy === 'save'}
          />
          <Button
            label="Discard"
            variant="ghost"
            onPress={onDiscard}
            loading={busy === 'discard'}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  body: { flex: 1, justifyContent: 'center', gap: 12, alignItems: 'center' },
  title: { textAlign: 'center' },
  context: { textAlign: 'center' },
  actions: { gap: 12 },
});
