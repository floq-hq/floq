/**
 * Dev kitchen-sink, ported from the pre-router App.tsx. Reachable at /dev in a
 * dev build (not linked from the app UI). Flips between the S1.3 UI primitives
 * preview, the M1.3 TFLite spike, and the S5.2 forecast-state mock without any
 * clobbering the others. Theme is provided by the root layout, so this no longer
 * wraps its own ThemeProvider.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ComponentsPreview } from '../components/dev/ComponentsPreview';
import { TFLiteSpike } from '../components/dev/TFLiteSpike';
import { ForecastStatesPanel } from '../components/dev/ForecastStatesPanel';

type Harness = 'ui' | 'tflite' | 'forecast';

export default function DevHarness() {
  const [harness, setHarness] = useState<Harness>('ui');
  return (
    <View style={styles.root}>
      <View style={styles.switcher}>
        <DevTab label="UI primitives" active={harness === 'ui'} onPress={() => setHarness('ui')} />
        <DevTab label="TFLite spike" active={harness === 'tflite'} onPress={() => setHarness('tflite')} />
        <DevTab label="Forecast" active={harness === 'forecast'} onPress={() => setHarness('forecast')} />
      </View>
      <View style={styles.body}>
        {harness === 'ui' && <ComponentsPreview />}
        {harness === 'tflite' && <TFLiteSpike />}
        {harness === 'forecast' && <ForecastStatesPanel />}
      </View>
    </View>
  );
}

function DevTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  switcher: {
    flexDirection: 'row',
    paddingTop: 56,
    paddingHorizontal: 12,
    gap: 8,
    backgroundColor: '#111',
  },
  body: { flex: 1 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#222' },
  tabActive: { backgroundColor: '#3b82f6' },
  tabText: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
});
