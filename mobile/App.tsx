import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeProvider } from './theme';
import { ComponentsPreview } from './components/dev/ComponentsPreview';
import { TFLiteSpike } from './components/dev/TFLiteSpike';
import { AuthHarness } from './components/dev/AuthHarness';

// Temporary dev entry until Expo Router lands (S2.2). Both children are dev-only
// kitchen sinks; the switcher just lets us flip between Mustafa's UI primitives
// (S1.3) and the M1.3 TFLite spike without either clobbering the other. A release
// build would render the real app root here instead.
type Harness = 'ui' | 'tflite' | 'auth';

export default function App() {
  const [harness, setHarness] = useState<Harness>('ui');
  return (
    <ThemeProvider>
      <View style={styles.root}>
        <View style={styles.switcher}>
          <DevTab
            label="UI primitives"
            active={harness === 'ui'}
            onPress={() => setHarness('ui')}
          />
          <DevTab
            label="TFLite spike"
            active={harness === 'tflite'}
            onPress={() => setHarness('tflite')}
          />
          <DevTab
            label="Auth"
            active={harness === 'auth'}
            onPress={() => setHarness('auth')}
          />
        </View>
        <View style={styles.body}>
          {harness === 'ui' ? (
            <ComponentsPreview />
          ) : harness === 'tflite' ? (
            <TFLiteSpike />
          ) : (
            <AuthHarness />
          )}
        </View>
      </View>
    </ThemeProvider>
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
    <Pressable
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

// Plain styles (not themed): this bar is a throwaway dev affordance, kept
// decoupled from the design system it sits above.
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
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#222',
  },
  tabActive: { backgroundColor: '#3b82f6' },
  tabText: { color: '#9ca3af', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#fff' },
});
