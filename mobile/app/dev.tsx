/**
 * Dev kitchen-sink, ported from the pre-router App.tsx. Reachable at /dev in a
 * dev build (not linked from the app UI). Flips between the S1.3 UI primitives
 * preview, the M1.3 TFLite spike, and the S5.2 forecast-state mock without any
 * clobbering the others. Theme is provided by the root layout, so this no longer
 * wraps its own ThemeProvider.
 */
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ComponentsPreview } from '../components/dev/ComponentsPreview';
import { TFLiteSpike } from '../components/dev/TFLiteSpike';
import { TimerModelCheck } from '../components/dev/TimerModelCheck';
import { ForecastStatesPanel } from '../components/dev/ForecastStatesPanel';
import { ShareCardPanel } from '../components/dev/ShareCardPanel';

type Harness = 'ui' | 'tflite' | 'timer-v1' | 'forecast' | 'share';

export default function DevHarness() {
  const [harness, setHarness] = useState<Harness>('ui');
  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.switcher}
        contentContainerStyle={styles.switcherContent}
      >
        <DevTab label="UI primitives" active={harness === 'ui'} onPress={() => setHarness('ui')} />
        <DevTab label="TFLite spike" active={harness === 'tflite'} onPress={() => setHarness('tflite')} />
        <DevTab label="Timer v1" active={harness === 'timer-v1'} onPress={() => setHarness('timer-v1')} />
        <DevTab label="Forecast" active={harness === 'forecast'} onPress={() => setHarness('forecast')} />
        <DevTab label="Share card" active={harness === 'share'} onPress={() => setHarness('share')} />
      </ScrollView>
      <View style={styles.body}>
        {harness === 'ui' && <ComponentsPreview />}
        {harness === 'tflite' && <TFLiteSpike />}
        {harness === 'timer-v1' && <TimerModelCheck />}
        {harness === 'forecast' && <ForecastStatesPanel />}
        {harness === 'share' && <ShareCardPanel />}
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
  // Horizontal scroller so all tabs are reachable; flexGrow:0 keeps it at content
  // height instead of eating the body.
  switcher: { flexGrow: 0, backgroundColor: '#111' },
  switcherContent: {
    flexDirection: 'row',
    paddingTop: 56,
    paddingBottom: 8,
    paddingHorizontal: 12,
    gap: 8,
    alignItems: 'center',
  },
  body: { flex: 1 },
  tab: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, backgroundColor: '#222' },
  tabActive: { backgroundColor: '#3b82f6' },
  tabText: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
});
