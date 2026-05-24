import { useCallback, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { useTensorflowModel } from 'react-native-fast-tflite';

// W1 TFLite spike (M1.3). Dev-only harness: loads the dummy model, runs one fake
// feature vector, and shows the output + inference time. Not part of the app.

// Must match ml/MODEL_SPEC.md.
const INPUT_DIM = 13;

// reason: Hermes provides `performance` at runtime, but it isn't in this TS lib.
const nowMs = (): number => (globalThis as any).performance?.now?.() ?? Date.now();

function makeFakeInput(): Float32Array<ArrayBuffer> {
  // Arbitrary normalized [0,1] vector — the spike only checks shape + that it runs.
  // Back it with an explicit ArrayBuffer so `.buffer` matches runSync's type.
  const v = new Float32Array(
    new ArrayBuffer(INPUT_DIM * Float32Array.BYTES_PER_ELEMENT),
  );
  for (let i = 0; i < INPUT_DIM; i += 1) {
    v[i] = ((i * 7) % 11) / 10;
  }
  return v;
}

export function TFLiteSpike() {
  const plugin = useTensorflowModel(
    require('../../assets/models/spike.tflite'),
    [], // default CPU delegate
  );
  const [result, setResult] = useState<{ output: number[]; ms: number } | null>(
    null,
  );
  const [runErr, setRunErr] = useState<string | null>(null);

  const run = useCallback(() => {
    if (plugin.state !== 'loaded') return;
    try {
      const input = makeFakeInput();
      const start = nowMs();
      // fast-tflite v3 exchanges raw ArrayBuffers, not typed arrays.
      const outputs = plugin.model.runSync([input.buffer]);
      const ms = nowMs() - start;
      const output = Array.from(new Float32Array(outputs[0]));
      setResult({ output, ms });
      console.log('[tflite-spike] output', output, 'in', ms.toFixed(2), 'ms');
    } catch (e) {
      setRunErr(String(e));
    }
  }, [plugin]);

  return (
    <View style={styles.box}>
      <Text style={styles.title}>TFLite spike — M1.3</Text>
      <Text>model state: {plugin.state}</Text>
      {plugin.state === 'error' ? (
        <Text style={styles.err}>{String(plugin.error)}</Text>
      ) : null}
      <Text>input dims: {INPUT_DIM}</Text>
      <View style={styles.gap} />
      <Button
        title="Run inference"
        onPress={run}
        disabled={plugin.state !== 'loaded'}
      />
      <View style={styles.gap} />
      {result ? (
        <>
          <Text>output: [{result.output.map((n) => n.toFixed(4)).join(', ')}]</Text>
          <Text style={result.ms < 50 ? styles.ok : styles.warn}>
            {result.ms.toFixed(2)} ms {result.ms < 50 ? '✓ < 50ms' : '✗ ≥ 50ms'}
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
