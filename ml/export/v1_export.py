"""Floq timer model v1 — export + parity check (M5.3).

PyTorch -> ONNX (opset 13) -> float32 TFLite (via onnx2tf), assert PyTorch and
TFLite agree (max abs diff < 1e-2) on the same input, then copy the model to
mobile/assets/models/floq-timer-v1.tflite for the dev-client build. Mirrors the
W1 spike pipeline (ml/spike/export.py) — the spike already proved this toolchain.

INT8 quantization is intentionally skipped: the production MLP (13->32->16->1,
~1k params) is ~4 KB in float32, far under the 500 KB budget, so INT8 would only
add the > 1e-2 quantization error the spec warns about (MODEL_SPEC.md) for no
size win. Re-evaluate INT8 only if a future model grows past the budget.

Run `python ml/training/v1.py` first, then `python ml/export/v1_export.py`.

On any failure (conversion error, parity >= 1e-2) STOP and log a decisions.md
entry per ml/CLAUDE.md — the whole on-device ML plan depends on this path.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

import numpy as np
import torch

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]  # export -> ml -> floq
TRAINING_DIR = REPO / "ml" / "training"
sys.path.insert(0, str(TRAINING_DIR))

from v1 import INPUT_DIM, PT_PATH, SEED, build_model  # noqa: E402

ONNX_PATH = HERE / "floq_timer_v1.onnx"
TF_DIR = HERE / "tf_out_v1"
MOBILE_MODEL = REPO / "mobile" / "assets" / "models" / "floq-timer-v1.tflite"
SIZE_BUDGET_KB = 500  # MODEL_SPEC.md acceptance


def main() -> None:
    # 1. Load the trained weights into the production architecture.
    if not PT_PATH.exists():
        raise FileNotFoundError(f"{PT_PATH} missing — run ml/training/v1.py first")
    model = build_model()
    model.load_state_dict(torch.load(PT_PATH, weights_only=True))
    model.eval()

    # 2. One fixed input, reused for export and the parity check.
    torch.manual_seed(SEED)
    x = torch.rand(1, INPUT_DIM)
    with torch.no_grad():
        torch_out = model(x).numpy()

    # 3. PyTorch -> ONNX (opset 13, explicit I/O names, dynamic batch).
    torch.onnx.export(
        model,
        x,
        str(ONNX_PATH),
        opset_version=13,
        input_names=["features"],
        output_names=["focus_minutes"],
        dynamic_axes={"features": {0: "batch"}, "focus_minutes": {0: "batch"}},
    )
    print(f"[export] wrote {ONNX_PATH}")

    # 4. ONNX -> float32 TFLite via onnx2tf.
    import onnx2tf

    onnx2tf.convert(
        input_onnx_file_path=str(ONNX_PATH),
        output_folder_path=str(TF_DIR),
        copy_onnx_input_output_names_to_tflite=True,
        non_verbose=True,
    )
    tflite_path = TF_DIR / f"{ONNX_PATH.stem}_float32.tflite"
    if not tflite_path.exists():
        raise FileNotFoundError(f"expected {tflite_path}; check onnx2tf output in {TF_DIR}")
    print(f"[export] wrote {tflite_path}")

    # 5. Parity: the same input through the TFLite interpreter.
    import tensorflow as tf

    interp = tf.lite.Interpreter(model_path=str(tflite_path))
    interp.allocate_tensors()
    inp = interp.get_input_details()[0]
    out = interp.get_output_details()[0]
    interp.set_tensor(inp["index"], x.numpy().astype(np.float32))
    interp.invoke()
    tflite_out = interp.get_tensor(out["index"])

    max_abs_diff = float(np.max(np.abs(torch_out - tflite_out)))
    print(f"[export] torch={torch_out.ravel()}  tflite={tflite_out.ravel()}")
    print(f"[export] max abs diff = {max_abs_diff:.2e}")
    assert max_abs_diff < 1e-2, f"parity FAILED: {max_abs_diff:.2e} >= 1e-2"
    print("[export] parity OK (< 1e-2)")

    # 6. Ship to the mobile bundle (new version, new file — never overwrite).
    MOBILE_MODEL.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(tflite_path, MOBILE_MODEL)
    size_kb = MOBILE_MODEL.stat().st_size / 1024
    print(f"[export] copied -> {MOBILE_MODEL} ({size_kb:.1f} KB)")
    assert size_kb < SIZE_BUDGET_KB, f"size {size_kb:.1f} KB exceeds {SIZE_BUDGET_KB} KB budget"
    print(f"[export] size OK (< {SIZE_BUDGET_KB} KB)")


if __name__ == "__main__":
    main()
