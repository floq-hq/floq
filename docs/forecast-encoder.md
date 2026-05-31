# Forecast encoder — post-MVP design (the "AI" performance forecaster)

> **Status:** post-MVP, not scheduled into W1–W8. The MVP ships **Holt's linear**
> (trend-aware smoothing) — see `decisions.md` L8 and `services/ml/forecast.ts`.
> This doc captures the design + sequencing so the learned forecaster is a
> deliberate, data-gated upgrade, not a rushed one.

## What it is

A model that **encodes a user's recent session sequence** (their focus-score
history + light context) and **predicts upcoming performance** — the "AI that
predicts the future from old data" idea. Concretely, a **global / cross-series**
model in the DeepAR / N-BEATS family, ideally an **ES-RNN-style hybrid** (the
model that won the M4 competition): exponential smoothing handles level/trend per
user, a small shared neural net learns the cross-user residual structure.

## Why it's post-MVP (the two hard constraints)

1. **It trains on cross-USER data, not per-user.** A neural net can't be trained
   on one person's 7–16 sessions — it overfits badly. The training signal is
   **many users' sequences pooled** (hundreds–thousands). The 7–16 sessions a
   single user has are the model's *input at inference*, not its training set.
   That cross-user corpus only exists once the **W8 beta + L23 consented,
   anonymized telemetry** accrue it. (Same data fault line as O11/L23.)
2. **Naïve deep learning loses on short series.** The M4 competition (100k series)
   showed pure ML/NN beaten by plain exponential smoothing; the winner was a
   *hybrid* (ES + RNN). So the target is **ES-RNN**, and the MVP's Holt's-linear
   forecast is both the honest baseline *and* the ES half of that hybrid — the
   upgrade is additive, not a throwaway.

## Options when the data exists

- **(a) ES-RNN-style hybrid (recommended).** On-device-friendly: classical ES for
  level/trend + a small global net (≤~2 MB TFLite, per the perf budget) for the
  residual. Trained offline (PyTorch → ONNX → TFLite), inference via
  `react-native-fast-tflite` (inference-only — fits). Keeps the L2/L23 stance:
  the model is global + anonymized; per-user inference stays on-device.
- **(b) Time-series foundation model (TimesFM / Chronos / Moirai).** Zero-shot
  forecasting from a short history, *no training*. But millions–billions of
  params → **server-side only**, which breaks on-device + privacy (data egress)
  and adds infra/cost. Possible as an opt-in cloud feature, not the default.
- **(c) Per-user fine-tuning.** Rejected for the same reason as the timer model
  (Option 4 in O11): `react-native-fast-tflite` is inference-only; on-device
  training needs a custom native module. Revisit only if (a) underperforms.

## Sequencing / triggers

1. **Now (MVP):** Holt's linear (shipped). Looks like a real forecast; on-device.
2. **During the W8 beta:** L23 telemetry accumulates anonymized
   `(focus_score sequence, context)` rows across users.
3. **When the corpus is large enough** (rough bar: the spec's "50+ sessions/user"
   equivalent *in aggregate* — hundreds of multi-session users): train the
   ES-RNN hybrid offline, validate it **beats Holt's linear on a held-out set**
   (the bar — per the M4 lesson, this is not automatic), export TFLite, wire via
   the existing M5.3/M5.4 inference path, and route the forecast through it behind
   the same regime gate.
4. **Spec change required at that point:** supersede `ml-regimes.md` Model B +
   `decisions.md` L8 with the learned-model decision, citing the validation.

## Honesty bar

Never claim the forecast is a learned model until it **demonstrably beats the
classical baseline on real held-out data**. Until then the chart is Holt's
linear — which is genuinely a trajectory prediction, just not a neural one.
