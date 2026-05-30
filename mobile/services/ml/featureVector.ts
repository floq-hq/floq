// TimerInputs → the 13-dim normalized feature vector the mature TFLite model
// consumes (M5.3). This is the on-device half of a CONTRACT: it must reproduce
// `encode_features` in ml/training/v1.py bit-for-bit, because the model was
// trained on vectors built that way — a mismatch silently feeds the model
// out-of-distribution inputs. The order + normalization are LOCKED in
// ml/MODEL_SPEC.md; changing either means retraining + re-exporting the model.
//
// Pure, zero React / native — unit-tested in plain Node against hand-computed
// values from the MODEL_SPEC table.
import type { TimerInputs, HourBucket } from '../timer';

/** Feature vector length (MODEL_SPEC.md). Mirrors ml/training/v1.py INPUT_DIM. */
export const INPUT_DIM = 13;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// Order matches the MODEL_SPEC.md one-hot block (idx 2–5).
const HOUR_ORDER: readonly HourBucket[] = ['morning', 'afternoon', 'evening', 'night'];

/**
 * Encode TimerInputs into the model's 13-dim Float32 input. Null history values
 * (a user with no rolling-7-day signal yet) normalize to 0, matching the Python
 * encoder's `x if x is not None else 0`.
 */
export function encodeFeatures(inputs: TimerInputs): Float32Array {
  const { task, context, history, onboarding } = inputs;
  const dow = context.day_of_week;
  const baseDecayed = onboarding.base_focus * onboarding.decay_weight;

  const v = new Float32Array(INPUT_DIM);
  v[0] = (task.difficulty - 1) / 4;
  v[1] = (clamp(task.estimated_minutes, 5, 180) - 5) / 175;
  v[2] = context.hour_bucket === 'morning' ? 1 : 0;
  v[3] = context.hour_bucket === 'afternoon' ? 1 : 0;
  v[4] = context.hour_bucket === 'evening' ? 1 : 0;
  v[5] = context.hour_bucket === 'night' ? 1 : 0;
  v[6] = (Math.sin((2 * Math.PI * dow) / 7) + 1) / 2;
  v[7] = (Math.cos((2 * Math.PI * dow) / 7) + 1) / 2;
  v[8] = clamp(context.sessions_today, 0, 10) / 10;
  v[9] = clamp(context.hours_since_last, 0, 48) / 48;
  v[10] = clamp(history.recent_focus_avg ?? 0, 0, 90) / 90;
  v[11] = clamp(history.recent_distract ?? 0, 0, 5) / 5;
  v[12] = clamp(baseDecayed, 10, 90) / 90;
  return v;
}

// HOUR_ORDER is exported for the test's drift-guard against the one-hot block.
export { HOUR_ORDER };
