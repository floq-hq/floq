# ml/MODEL_SPEC.md — Floq timer model (mature regime)

W1 deliverable. Finalizes the feature vector so the TFLite spike (M1.3) and the
mobile input-prep have an exact contract. **Changing the feature vector after
the spike is costly** (see `ml/CLAUDE.md`) — surface before editing.

The model only runs in the **mature regime (sessions 14+)**. Cold (0–4) and
warming (5–13) are pure TypeScript and must not be duplicated in Python.

## Task

Regression. Target = recommended **focus minutes** for the next session.
Output clamped to **15–90 post-inference** (in TS, not in the model).

## Feature vector — 13 dims, normalized to ~[0, 1]

`day_of_week` uses **sin/cos** cyclical encoding (2 dims) rather than one-hot (7),
keeping the vector compact for a tiny model. (One-hot would make it 18.)

| idx | feature | source | normalization |
|----:|---------|--------|---------------|
| 0 | `task_difficulty` | LLM 1–5 | `(d - 1) / 4` |
| 1 | `task_est_minutes` | LLM | `(clamp(m,5,180) - 5) / 175` |
| 2 | `hour_morning` | context | one-hot |
| 3 | `hour_afternoon` | context | one-hot |
| 4 | `hour_evening` | context | one-hot |
| 5 | `hour_night` | context | one-hot |
| 6 | `dow_sin` | context | `sin(2π · dow / 7)`, mapped to `(x+1)/2` |
| 7 | `dow_cos` | context | `cos(2π · dow / 7)`, mapped to `(x+1)/2` |
| 8 | `sessions_today` | context | `clamp(s,0,10) / 10` |
| 9 | `hours_since_last` | context | `clamp(h,0,48) / 48` |
| 10 | `recent_focus_avg_7d` | history | `clamp(f,0,90) / 90` |
| 11 | `recent_distract_rate_7d` | history | `clamp(r,0,5) / 5` |
| 12 | `onboarding_base_focus` | onboarding × decay | `clamp(b,10,90) / 90` |

**`INPUT_DIM = 13`.** This constant is mirrored in `ml/spike/dummy_model.py` and
on the mobile side wherever the input vector is built.

## Architecture

- **Real v1 model (M5.3):** 3-layer MLP `13 → 32 → 16 → 1`. Tiny on purpose.
  Quantized INT8 for deployment. Size budget **< 500 KB** (< 2 MB worst case).
- **Spike dummy (M1.3):** a deliberately deeper **5-layer** MLP `13 → 64 → 32 →
  16 → 8 → 1`. The depth is to stress the converter, not for accuracy — the spike
  only proves the export/load/inference path works on device.

## Loss / training (M5.3, not the spike)

- MSE on the focus minutes that produced the highest `focus_score` per
  (user, similar-context) bucket.
- W1–W5: synthetic data from the cold-start formula + noise (plumbing only —
  the model just relearns the formula; **flag clearly**, never ship to TestFlight
  without a `decisions.md` note).

## Quantization note (spike vs real)

The spike converts to **float32 TFLite** and validates **parity < 1e-2** against
PyTorch. INT8 quantization is deferred to the real model (M5.3): INT8 error
typically exceeds 1e-2, so the parity gate applies to the float path, and INT8 is
validated separately against the size/accuracy budget.
