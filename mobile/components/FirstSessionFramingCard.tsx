/**
 * First-session framing card (S2.5). Shown exactly once, immediately before the
 * user's very first session, to teach the phase indicator they're about to see
 * (onboarding.md). 4 swipeable steps + a Next button; the final "Got it, let's
 * go" sets has_seen_intro and dismisses.
 *
 * `readOnly` re-show mode (the session-screen info icon, S3) skips the
 * has_seen_intro write and just closes. Copy is verbatim from onboarding.md.
 */
import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from './ui';
import { markIntroSeen } from '../services/intro/seen';
import { useTheme } from '../theme';

const STEPS: { title: string; body: string }[] = [
  {
    title: 'Floq\'s timer learns from your brain, not the clock.',
    body: 'Most apps interrupt you at 25 minutes. Your brain runs on different cycles.',
  },
  {
    title: 'The first 20 minutes will feel hard.',
    body: 'That\'s the Struggle phase — your brain loading information. Push through; this is the on-ramp, not failure.',
  },
  {
    title: 'Then your brain shifts.',
    body: 'Release, then Flow. You\'ll watch the phase indicator move. Time will feel different.',
  },
  {
    title: 'One tap if you get distracted.',
    body: 'No shame, just data. The app learns your real rhythm from how you actually work.',
  },
];

export function FirstSessionFramingCard({
  visible,
  onDismiss,
  readOnly = false,
}: {
  visible: boolean;
  onDismiss: () => void;
  readOnly?: boolean;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === STEPS.length - 1;

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };
  const next = () => scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
  const finish = () => {
    if (!readOnly) markIntroSeen(); // the one place has_seen_intro is set
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={readOnly ? onDismiss : finish}
    >
      <View style={[styles.root, { backgroundColor: theme.bg, paddingBottom: insets.bottom + 16 }]}>
        {readOnly ? (
          <Pressable
            onPress={onDismiss}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={[styles.close, { top: insets.top + 8 }]}
          >
            <Text variant="heading" color={theme.textMuted}>
              ✕
            </Text>
          </Pressable>
        ) : null}

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          style={styles.pager}
        >
          {STEPS.map((step, i) => (
            <View key={i} style={[styles.page, { width, paddingTop: insets.top + 24 }]}>
              <Text variant="title" style={styles.title}>
                {step.title}
              </Text>
              <Text variant="body" color={theme.textMuted} style={styles.body}>
                {step.body}
              </Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === index ? styles.dotActive : null,
                  { backgroundColor: i === index ? theme.accent : theme.border },
                ]}
              />
            ))}
          </View>
          {isLast ? (
            <Button label={readOnly ? 'Done' : 'Got it, let\'s go'} onPress={finish} />
          ) : (
            <Button label="Next" onPress={next} />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  close: { position: 'absolute', right: 24, zIndex: 1 },
  pager: { flex: 1 },
  page: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center', gap: 16 },
  title: { textAlign: 'center' },
  body: { textAlign: 'center' },
  footer: { paddingHorizontal: 24, gap: 20, alignItems: 'center' },
  dots: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 22 },
});
