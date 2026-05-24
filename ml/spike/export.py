"""TFLite spike (M1.3) — export + parity check.

PyTorch -> ONNX (opset 13) -> float32 TFLite (via onnx2tf), then assert the
PyTorch and TFLite outputs agree (max abs diff < 1e-2) on the same input, and
copy the model to mobile/assets/models/spike.tflite for the dev-client build.

Run `python ml/spike/dummy_model.py` first. Then `python ml/spike/export.py`.

If any step fails (conversion error, parity > 1e-2, etc.), this is the signal
the blueprint warns about: STOP and log a new entry in shared/spec/decisions.md
describing the failure mode and the fallback (e.g. drop to SDK 54, or
server-side inference). The whole ML deployment plan depends on this path.
"""

from __future__ import annotations

import shutil
from pathlib import Path

import numpy as np
import torch

from dummy_model import INPUT_DIM, SEED, PT_PATH, build_model

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]  # spike -> ml -> floq
ONNX_PATH = HERE / "spike.onnx"
TF_DIR = HERE / "tf_out"
MOBILE_MODEL = REPO / "mobile" / "assets" / "models" / "spike.tflite"


def main() -> None:
    # 1. Load the seeded dummy model.
    model = build_model()
    if PT_PATH.exists():
        model.load_state_dict(torch.load(PT_PATH))
    model.eval()

    # 2. One fixed input, reused for export and the parity check.
    torch.manual_seed(SEED)
    x = torch.rand(1, INPUT_DIM)
    with torch.no_grad():
        torch_out = model(x).numpy()

    # 3. PyTorch -> ONNX.
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
        raise FileNotFoundError(
            f"expected {tflite_path}; check onnx2tf output in {TF_DIR}"
        )
    print(f"[export] wrote {tflite_path}")

    # 5. Parity: same input through the TFLite interpreter.
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

    # 6. Ship to the mobile bundle.
    MOBILE_MODEL.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(tflite_path, MOBILE_MODEL)
    size_kb = MOBILE_MODEL.stat().st_size / 1024
    print(f"[export] copied -> {MOBILE_MODEL} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
