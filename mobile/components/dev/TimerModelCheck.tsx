import { useCallback, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { encodeFeatures } from '../../services/ml/featureVector';
import { MODEL_FILENAME } from '../../services/ml/modelVersion';
import type { TimerInputs } from '../../services/timer';

// M5.3 device-acceptance harness (dev-only). Loads the REAL deployed model
// (floq-timer-v1.tflite), runs a realistic encoded feature vector through the
// production path (encodeFeatures → runSync → decode), and shows the predicted
// focus minutes + inference time. Use this to confirm the two device-only M5.3
// criteria: "model loads in the dev client" and "inference < 50 ms on iPhone 12".
//
// The model is dormant in the app (MATURE_MODEL_ACTIVE=false until a real-data
// v2), so this harness is the only place it actually runs on-device.

// reason: Hermes provides `performance` at runtime, but it isn't in this TS lib.
const nowMs = (): number => (globalThis as any).performance?.now?.() ?? Date.now();

// A representative mature-user context (sessions_completed ≥ 14), hard task,
// morning. Exercises the real 13-dim encoder so this is a true end-to-end check.
const SAMPLE_INPUTS: TimerInputs = {
  task: { difficulty: 4, estimated_minutes: 45 },
  context: { hour_bucket: 'morning', day_of_week: 2, sessions_today: 1, hours_since_last: 3 },
  history: { recent_focus_avg: 42, recent_distract: 1.2 },
  onboarding: {
    base_focus: 60,
    distraction_level: 'neutral',
    preferred_time: 'morning',
    use_case: 'work',
    decay_weight: 0.1,
  },
  sessions_completed: 20,
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function TimerModelCheck() {
  const plugin = useTensorflowModel(require('../../assets/models/floq-timer-v1.tflite'), []);
  const [result, setResult] = useState<{ raw: number; focus: number; ms: number } | null>(null);
  const [runErr, setRunErr] = useState<string | null>(null);

  const run = useCallback(() => {
    if (plugin.state !== 'loaded') return;
    try {
      const features = encodeFeatures(SAMPLE_INPUTS); // real production encoder
      const start = nowMs();
      // reason: a fresh Float32Array's .buffer is an ArrayBuffer at runtime; the
      // type is the wider ArrayBufferLike, which fast-tflite's runSync narrows.
      const outputs = plugin.model.runSync([features.buffer as ArrayBuffer]);
      const ms = nowMs() - start;
      const raw = new Float32Array(outputs[0])[0];
      const focus = Math.floor(clamp(raw, 15, 90)); // same decode as matureInfer
      setResult({ raw, focus, ms });
      console.log('[timer-v1] raw', raw, 'focus', focus, 'in', ms.toFixed(2), 'ms');
    } catch (e) {
      setRunErr(String(e));
    }
  }, [plugin]);

  return (
    <View style={styles.box}>
      <Text style={styles.title}>Timer model v1 — M5.3 check</Text>
      <Text>model: {MODEL_FILENAME}</Text>
      <Text style={plugin.state === 'loaded' ? styles.ok : undefined}>
        load state: {plugin.state} {plugin.state === 'loaded' ? '✓ loads in dev client' : ''}
      </Text>
      {plugin.state === 'error' ? <Text style={styles.err}>{String(plugin.error)}</Text> : null}
      <View style={styles.gap} />
      <Button title="Run inference" onPress={run} disabled={plugin.state !== 'loaded'} />
      <View style={styles.gap} />
      {result ? (
        <>
          <Text>raw output: {result.raw.toFixed(4)}</Text>
          <Text>→ focus suggestion: {result.focus} min (clamped 15–90)</Text>
          <Text style={result.ms < 50 ? styles.ok : styles.warn}>
            {result.ms.toFixed(2)} ms {result.ms < 50 ? '✓ < 50ms' : '✗ ≥ 50ms (check on real iPhone 12)'}
          </Text>
        </>
      ) : null}
      {runErr ? <Text style={styles.err}>{runErr}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 4, alignItems: 'center' },
  title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  gap: { height: 12 },
  ok: { color: 'green', fontWeight: '600' },
  warn: { color: 'orange', fontWeight: '600' },
  err: { color: 'red' },
});
