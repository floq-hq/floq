/**
 * GOT DISTRACTED button (S3.2). Always visible during a session, large tap
 * target, ONE tap — no confirmation dialog (session-flow.md: "No shame, just
 * data"; mobile/CLAUDE.md: "One tap, no confirm").
 *
 * Tap → medium haptic + an optimistic distraction log (logDistraction, the M3.2
 * funnel) + a single danger flash that settles back (no looping/pulsing). The
 * timestamp is appended to the active session locally and batched to the
 * session-end write (S3.3) — never written per tap. The count is read straight
 * from the active-session store so the increment shows immediately.
 *
 * Haptics need expo-haptics in the native dev client; the call is guarded so the
 * tap still logs + flashes before a rebuild, then buzzes once the client is
 * rebuilt.
 */
import { Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { getTextStyle } from '../../theme/typography';
import { useTheme } from '../../theme';
import { logDistraction } from '../../services/session/distraction';
import { useActiveSessionStore } from '../../stores/useActiveSessionStore';

function buzz() {
  // Guarded: the native module is only present after a dev-client rebuild.
  // Pre-rebuild the tap still logs + flashes; it just doesn't buzz.
  try {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  } catch {
    // expo-haptics native module unavailable — ignore.
  }
}

export function DistractionButton() {
  const theme = useTheme();
  const count = useActiveSessionStore((s) => s.active?.distractions.length ?? 0);
  const flash = useSharedValue(0);

  const onPress = () => {
    buzz();
    logDistraction();
    // 0 → 1 (quick in) → 0 (slower settle). One pulse, no loop.
    flash.value = withSequence(
      withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),
      withTiming(0, { duration: 360, easing: Easing.inOut(Easing.quad) }),
    );
  };

  const containerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(flash.value, [0, 1], [theme.bgElevated, theme.danger]),
    borderColor: interpolateColor(flash.value, [0, 1], [theme.border, theme.danger]),
  }));
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(flash.value, [0, 1], [theme.textMuted, theme.textInverse]),
  }));

  const label = count > 0 ? `GOT DISTRACTED · ${count}` : 'GOT DISTRACTED';

  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={count > 0 ? `Got distracted, ${count} logged` : 'Got distracted'}
    >
      <Animated.View style={[styles.button, containerStyle]}>
        <Animated.Text style={[getTextStyle('label', theme), styles.label, labelStyle]} numberOfLines={1}>
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { letterSpacing: 0.5 },
});
