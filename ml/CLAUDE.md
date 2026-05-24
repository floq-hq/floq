# ml/ — CLAUDE.md

ML-specific guidance for Mohamed's domain. Inherits the root `CLAUDE.md`.

## You are working on Floq's ML pipeline

If the task is about React Native, screens, or anything in `mobile/app/` — stop, you're in the wrong folder.

## Pipeline overview

```
Python training (PyTorch / sklearn) → ONNX export → TFLite conversion → ship to mobile/assets/models/
```

The mobile app loads the TFLite model via `react-native-fast-tflite` and runs inference on-device. No server-side inference, ever (cost + privacy).

## Three regimes — the model is only one of them

Read `shared/spec/ml-regimes.md` carefully. The router picks one of:

1. **Cold (sessions 0–4)** — pure cold-start formula, no ML. Implemented in TypeScript in `mobile/services/timer/coldStart.ts`. **Do not duplicate this in Python.**
2. **Warming (sessions 5–13)** — alpha-blend between the cold formula and the user's behavioral averages. Also TypeScript.
3. **Mature (sessions 14+)** — TFLite model. This is the only place your trained model runs.

So the Python work targets the mature regime. Before training, the cold and warming regimes must already be shipping.

## Model v1 spec (W6 deliverable — finalize spec in W1)

Before writing training code, fill in `ml/MODEL_SPEC.md` with:

- **Task:** regression. Target = recommended focus minutes for the next session.
- **Input features** (vector form, normalized):
  - `task_difficulty` ∈ {1..5}
  - `task_est_minutes` (clamped 5–180)
  - `hour_bucket` one-hot (morning / afternoon / evening / night)
  - `day_of_week` one-hot or sin/cos encoding (decide)
  - `sessions_today` (clamped 0–10)
  - `hours_since_last` (clamped 0–48)
  - `recent_focus_avg_7d` (minutes)
  - `recent_distract_rate_7d` (distractions per session)
  - `onboarding_base_focus` (decayed weight; decay over 14 days)
- **Output:** single scalar — recommended focus minutes. Clamped to 15–90 post-inference.
- **Loss:** MSE on focus minutes that resulted in the highest `focus_score` per (user, similar-context) bucket.
- **Architecture:** start with a 3-layer MLP (input → 32 → 16 → 1). Tiny on purpose. Quantize to INT8 for deployment.
- **Size budget:** < 500 KB TFLite, < 2 MB worst case.

If any of the above is unclear, surface it before writing training code.

## Training data

In W1–W5 there is no real user data. Use:

1. **Synthetic data** generated from the cold-start formula + noise. Useful for plumbing only — the model will just learn to reproduce the formula. Mark this clearly.
2. **Lab-collected real data** from beta users in W8. Retrain v1 on this before TestFlight expands.

Never deploy a model trained only on synthetic data to TestFlight without flagging it in `shared/spec/decisions.md`.

## Export pipeline

`ml/export/` contains the conversion script. Steps:

1. Train in PyTorch → save `.pt`
2. Export to ONNX with `torch.onnx.export`, opset 13+, with explicit input/output names.
3. Convert ONNX → TFLite via `onnx2tf` (or `onnx-tf` if that fails).
4. Quantize INT8 with a representative dataset.
5. Validate: run the same input through PyTorch and TFLite, assert max abs diff < 1e-2.
6. Copy to `mobile/assets/models/floq-timer-v{N}.tflite`.
7. Bump the version in `mobile/services/ml/modelVersion.ts`.

Never overwrite a deployed model file. New version, new file.

## TFLite spike (W3, not W6)

Before training anything, prove the deployment path:

1. Make a dummy MLP in PyTorch with the **exact input shape from MODEL_SPEC.md**.
2. Export → ONNX → TFLite.
3. Load it in the mobile app via `react-native-fast-tflite` using a dev client build.
4. Run inference with a fake feature vector. Confirm output shape and that it runs in < 50ms on iPhone 12.

If this fails, escalate immediately — the entire ML deployment plan changes.

## Reproducibility

- Set seeds everywhere (`torch.manual_seed`, `numpy.random.seed`, `random.seed`).
- Commit a `requirements.txt` with pinned versions.
- Every trained model gets a `metadata.json`: training data hash, hyperparams, eval metrics, git SHA.

## Things to ask before

- Switching frameworks (PyTorch → JAX, etc.). We picked PyTorch on purpose.
- Adding any heavy dependency (transformers, lightning, etc.). Tiny model — keep deps tiny.
- Changing the feature vector after the TFLite spike. The mobile-side input prep depends on it.
