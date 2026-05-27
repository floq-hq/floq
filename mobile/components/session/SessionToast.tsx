/**
 * On-return session toast (S3.4). A subtle, non-interactive notice that drops in
 * when M3.4's background policy logs a background distraction — e.g.
 * "Backgrounded for 47s — logged a distraction." — then auto-dismisses.
 *
 * Presentational only: the focus screen owns the message and feeds it from
 * startBackgroundPolicy({ onBackgroundDistraction }). pointerEvents is off so the
 * toast never intercepts a DONE / GOT DISTRACTED tap underneath it.
 */
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { Text } from '../ui';
import { useTheme } from '../../theme';

/** How long the notice stays up before auto-dismissing. */
export const SESSION_TOAST_DURATION_MS = 4000;

export interface SessionToastProps {
  /** Current notice text, or null when nothing is showing. */
  message: string | null;
  /** Changes per background episode so a repeat re-triggers the timer + animation. */
  nonce?: number;
  /** Fired when the auto-dismiss timer elapses; clears the parent's message state. */
  onDismiss: () => void;
  /** Distance from the top of the screen — pass the safe-area inset plus a little. */
  topOffset?: number;
}

export function SessionToast({ message, nonce, onDismiss, topOffset = 0 }: SessionToastProps) {
  const theme = useTheme();

  // Auto-dismiss. Re-runs (and so resets the timer) on a new message or nonce.
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onDismiss, SESSION_TOAST_DURATION_MS);
    return () => clearTimeout(id);
  }, [message, nonce, onDismiss]);

  if (!message) return null;

  return (
    <Animated.View
      key={nonce}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(180)}
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.wrap, { top: topOffset }]}
    >
      <View style={[styles.chip, { backgroundColor: theme.bgElevated, borderColor: theme.border }]}>
        <Text variant="caption" color={theme.textMuted} style={styles.text}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 24 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1 },
  text: { textAlign: 'center' },
});
