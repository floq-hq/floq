// Mature-regime inference (M5.3) — runs floq-timer-v1.tflite on-device and maps
// its scalar output to a SessionPlan. Injected into routeSessionPlan as the
// `MatureInfer` callback (sessions 14+); cold/warming never touch this.
//
// react-native-fast-tflite and the .tflite asset are reached ONLY through a lazy
// dynamic import inside `ensureMatureModelLoaded`, so importing this module in a
// node/test context (e.g. compute.test.ts) touches nothing native. Until the
// model is loaded — or if loading fails — `matureInfer` returns null and
// routeSessionPlan falls back to the warming blend (its documented defensive
// path). The model is ~6 KB and loads fast, so a mature user's first session may
// fall back to warming once; subsequent starts use the model.
import type { MatureInfer } from './regimeRouter';
import type { SessionPlan, TimerInputs } from '../timer';
import {
  BREAK_MAX,
  BREAK_MIN,
  BREAK_RATIO,
  FOCUS_MAX,
  FOCUS_MIN,
} from '../timer/coldStart';
import { encodeFeatures } from './featureVector';

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Minimal structural view of a loaded react-native-fast-tflite model. Kept
 *  local so this module needs no static import of the native package (which
 *  also keeps it node-safe to import). */
interface RunnableModel {
  runSync(inputs: ArrayBufferLike[]): unknown[];
}

// Loosely-typed view of the lazily-imported native package — deliberately not
// the lib's own types (they pull native type defs and over-constrain the asset
// + delegate args; we only need runSync, which we re-type via RunnableModel).
type FastTflite = {
  loadTensorflowModel: (source: unknown, delegate?: string) => Promise<RunnableModel>;
};

let model: RunnableModel | null = null;
let loadStarted = false;

/**
 * Lazily load the deployed TFLite model. Native access (the package + the Metro
 * `.tflite` asset require) lives inside this function so the module stays
 * node-safe to import. Idempotent; any failure leaves `model` null → the mature
 * path degrades to warming.
 */
export async function ensureMatureModelLoaded(): Promise<void> {
  if (model || loadStarted) return;
  loadStarted = true;
  try {
    const tflite = (await import('react-native-fast-tflite')) as unknown as FastTflite;
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro asset ref; lazy so a node import stays native-free
    const asset = require('../../assets/models/floq-timer-v1.tflite');
    model = await tflite.loadTensorflowModel(asset);
  } catch {
    model = null; // unavailable → warming fallback (regimeRouter handles it)
  }
}

/**
 * Run one inference and decode the raw scalar into a SessionPlan, or null if the
 * output is unusable. Pure given `m` — unit-tested with a fake model. Clamp/floor
 * discipline matches cold/warming (focus clamped 15–90, break = floor(focus×0.22)
 * clamped 5–25); MODEL_SPEC.md keeps the clamp in TS, not in the model.
 */
export function runMatureInference(m: RunnableModel, inputs: TimerInputs): SessionPlan | null {
  const features = encodeFeatures(inputs);
  let raw: number;
  try {
    const out = m.runSync([features.buffer]);
    raw = new Float32Array(out[0] as ArrayBufferLike)[0];
  } catch {
    return null; // a throwing model must not break session start
  }
  if (!Number.isFinite(raw)) return null;
  const focusMinutes = Math.floor(clamp(raw, FOCUS_MIN, FOCUS_MAX));
  const breakMinutes = Math.floor(clamp(focusMinutes * BREAK_RATIO, BREAK_MIN, BREAK_MAX));
  return { focusMinutes, breakMinutes, regime: 'mature' };
}

/**
 * L23 / O11 — the v1 model is SYNTHETIC and can't beat the warming blend (which
 * runs on the user's real history), so the mature regime stays DORMANT: we do
 * not route real users to the placeholder while we collect the opted-in real
 * data that a v2 needs. Flip to `true` when a real-data v2 ships.
 */
export const MATURE_MODEL_ACTIVE = false;

/**
 * The MatureInfer passed to routeSessionPlan. Synchronous (as the router
 * requires). While dormant (above) it always returns null → routeSessionPlan
 * falls back to the warming blend. When active, returns null until the model is
 * loaded (kicking off the lazy load) so a later mature session gets a real run.
 */
export const matureInfer: MatureInfer = (inputs) => {
  if (!MATURE_MODEL_ACTIVE) return null; // dormant → warming fallback
  if (!model) {
    void ensureMatureModelLoaded();
    return null;
  }
  return runMatureInference(model, inputs);
};
