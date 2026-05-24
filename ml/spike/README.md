# TFLite spike (M1.3)

Proves the on-device ML deployment path **before** we build 5 weeks on top of it:
PyTorch → ONNX → TFLite → load via `react-native-fast-tflite` on a real iPhone.

This is a throwaway dummy model (untrained, 5-layer MLP, 13-dim input per
`ml/MODEL_SPEC.md`). We only care that it converts, bundles, loads, and runs
fast on device.

## A. Generate the model (your machine — needs a Python 3.12 env)

> Don't use the repo's system Python 3.14 (no stable torch/TF wheels).
>
> **Apple Silicon:** the env must be **native arm64** — torch dropped Intel-mac
> wheels after 2.2.2, so an x86_64/Rosetta env fails on `torch==2.4.1`. Verify
> with `python -c "import platform; print(platform.machine())"` → must say
> `arm64`. From an Intel base conda, force it:

```bash
# verified working setup (macOS arm64, 2026-05-24)
CONDA_SUBDIR=osx-arm64 conda create -n floq-ml python=3.12 -y
conda run -n floq-ml pip install -r ml/requirements.txt   # includes onnx2tf + tf_keras companions

conda run -n floq-ml python ml/spike/dummy_model.py   # -> spike/spike_model.pt
conda run -n floq-ml python ml/spike/export.py        # -> spike.onnx, tf_out/, and
                                                      #    mobile/assets/models/spike.tflite
```

`export.py` asserts **PyTorch vs TFLite max abs diff < 1e-2** and prints the
model size. If it prints `parity OK` and copies `spike.tflite`, step A passed.
(Verified: max abs diff ≈ 4e-08, spike.tflite ≈ 18 KB.)

INT8 quantization and the <500 KB size budget are deferred to the real model
(M5.3) — see `ml/MODEL_SPEC.md`.

## B. Build the dev client + run on device (your machine + iPhone)

`react-native-fast-tflite` is a native (Nitro) module, so Expo Go won't work —
you need a dev client. The config plugin and `metro.config.js` (`.tflite` asset
ext) are already set up.

```bash
cd mobile
# spike.tflite MUST exist (step A) before bundling.
eas build --profile development --platform ios   # ~15 min first time
```

Install the build on an **iPhone 12 or newer**, then:

```bash
npx expo start --dev-client
```

`App.tsx` renders the spike harness. Tap **Run inference**.

## C. Acceptance checklist

- [ ] `export.py` parity check passes (< 1e-2)
- [ ] App loads the model — screen shows `model state: loaded`
- [ ] **Run inference** prints an output array (shape `[1]`) to the console
- [ ] Inference time shows **< 50 ms** on iPhone 12+
- [ ] Capture a short screen recording / GIF for the issue (#3)

## D. If it fails — escalate

Per the blueprint, a failure here changes the whole ML plan. **Stop and add a
new entry to `shared/spec/decisions.md`** describing:

- which step failed (convert / bundle / load / inference / >50 ms),
- the exact error,
- the proposed fallback: drop to SDK 54, swap the converter (`onnx-tf` instead
  of `onnx2tf`, or Google's `ai-edge-torch`), or fall back to server-side
  inference (this would also revisit decision **L2**).

## Files

| File | What |
|------|------|
| `dummy_model.py` | Seeded 5-layer dummy MLP (`INPUT_DIM = 13`) |
| `export.py` | Torch → ONNX → float32 TFLite + parity check + copy to mobile |
| `../requirements.txt` | Pinned deps (run in a 3.11/3.12 venv) |
| `../MODEL_SPEC.md` | The locked feature vector this spike's input shape mirrors |

Generated artifacts (`spike_model.pt`, `spike.onnx`, `tf_out/`) are gitignored.
`mobile/assets/models/spike.tflite` is produced by `export.py` and needed at
build time — commit it (or regenerate) before running EAS.
