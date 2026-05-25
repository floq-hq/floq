/**
 * Themed text input with an optional label and inline error. S1.3 shipped no
 * input primitive; the auth forms (and later onboarding / brain-dump) need one,
 * so it lives here in the design system rather than being re-styled per screen.
 *
 *   - border: borderStrong at rest, accent on focus, danger when `error` is set.
 *   - fills `bgElevated`; placeholder + label use `textMuted`.
 *   - radius 8, height 52 — matches Button `lg` so stacked forms align.
 */
import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '../../theme';
import { Text } from './Text';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  label?: string;
  error?: string;
};

export function TextField({ label, error, onFocus, onBlur, ...rest }: TextFieldProps) {
  const theme = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error ? theme.danger : focused ? theme.accent : theme.borderStrong;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text variant="label" color={theme.textMuted}>
          {label}
        </Text>
      ) : null}
      <TextInput
        accessibilityLabel={label}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        placeholderTextColor={theme.textMuted}
        style={[
          styles.input,
          { backgroundColor: theme.bgElevated, borderColor, color: theme.text },
        ]}
      />
      {error ? (
        <Text variant="caption" color={theme.danger}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    fontSize: 16,
  },
});
