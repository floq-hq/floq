/**
 * Session timer display (S3.1). The big MM:SS clock at the center of the session
 * screen.
 *
 * The tick runs entirely on the UI thread: a Reanimated shared value (driven by
 * the screen's frame callback) feeds an animated TextInput whose native `text`
 * prop is updated off the JS thread (mobile/CLAUDE.md: "the tick must not
 * setState on the JS thread"). React never re-renders as the seconds advance, so
 * the clock stays smooth across a full 90-min session.
 *
 * Uses the `display` type token (56, tabular figures so digits don't jitter) and
 * the calm single text color — phase color lives only in the PhaseIndicator pill.
 */
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';
import Animated, { useAnimatedProps, type SharedValue } from 'react-native-reanimated';
import { useTheme } from '../../theme';
import { getTextStyle } from '../../theme/typography';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

/** seconds → "MM:SS". Worklet: called from the UI thread inside useAnimatedProps. */
function formatTime(totalSeconds: number): string {
  'worklet';
  const s = totalSeconds < 0 ? 0 : totalSeconds;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = sec < 10 ? `0${sec}` : `${sec}`;
  return `${mm}:${ss}`;
}

export function SessionTimer({ elapsedSeconds }: { elapsedSeconds: SharedValue<number> }) {
  const theme = useTheme();

  const animatedProps = useAnimatedProps(() => {
    // reason: Reanimated mutates TextInput's native `text` prop off the JS thread
    // so the clock never re-renders React; `text` isn't on the public props type.
    return { text: formatTime(elapsedSeconds.value) } as unknown as Partial<TextInputProps>;
  });

  return (
    <AnimatedTextInput
      editable={false}
      caretHidden
      scrollEnabled={false}
      underlineColorAndroid="transparent"
      defaultValue="00:00"
      animatedProps={animatedProps}
      // The clock is decorative text; the screen exposes the session state to a11y.
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[getTextStyle('display', theme), styles.timer]}
    />
  );
}

const styles = StyleSheet.create({
  timer: { textAlign: 'center', padding: 0 },
});
