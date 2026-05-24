/**
 * Themed slider. Thin wrapper over @react-native-community/slider that applies
 * the theme to the track + thumb so callers never pass raw colors.
 *
 *   filled track  → accent
 *   empty track   → border
 *   thumb         → accent
 *
 * Note: this is a native module, so it only renders in a dev/standalone build,
 * not Expo Go.
 */
import RNCSlider from '@react-native-community/slider';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme';

export type SliderProps = {
  value: number;
  onValueChange: (value: number) => void;
  minimumValue?: number;
  maximumValue?: number;
  step?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Slider({
  value,
  onValueChange,
  minimumValue = 0,
  maximumValue = 1,
  step = 0,
  disabled = false,
  style,
}: SliderProps) {
  const theme = useTheme();
  return (
    <RNCSlider
      style={[styles.slider, style]}
      value={value}
      onValueChange={onValueChange}
      minimumValue={minimumValue}
      maximumValue={maximumValue}
      step={step}
      disabled={disabled}
      minimumTrackTintColor={theme.accent}
      maximumTrackTintColor={theme.border}
      thumbTintColor={theme.accent}
    />
  );
}

const styles = StyleSheet.create({
  slider: { width: '100%', height: 40 },
});
