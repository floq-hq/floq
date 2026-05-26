/**
 * Shared layout for the onboarding Q1–Q4 screens (S2.1): the question heading,
 * an optional one-line helper, the answer control (slider / segmented), and a
 * single Continue CTA pinned to the bottom.
 *
 * Navigation chrome (the 4-dot progress indicator + Back) lives in the group
 * `_layout`, so this scaffold owns only the question content + CTA. The top
 * inset is handled by the layout header; this handles the bottom inset.
 */
import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '../ui';
import { useTheme } from '../../theme';

export function QuestionScaffold({
  question,
  helper,
  children,
  onContinue,
  continueDisabled = false,
  continueLabel = 'Continue',
}: {
  question: string;
  helper?: string;
  children: ReactNode;
  onContinue: () => void;
  continueDisabled?: boolean;
  continueLabel?: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.header}>
        <Text variant="title">{question}</Text>
        {helper ? (
          <Text variant="body" color={theme.textMuted}>
            {helper}
          </Text>
        ) : null}
      </View>

      <View style={styles.control}>{children}</View>

      <Button label={continueLabel} onPress={onContinue} disabled={continueDisabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
  header: { gap: 8 },
  // The control sits in the breathing room between the question and the CTA.
  control: { flex: 1, justifyContent: 'center', gap: 16 },
});
