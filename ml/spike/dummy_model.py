"""TFLite spike (M1.3) — dummy model.

A deliberately deep 5-layer MLP with the EXACT input shape from MODEL_SPEC.md
(INPUT_DIM = 13). It is NOT trained — its only job is to prove the
PyTorch -> ONNX -> TFLite -> on-device path. Weights are seeded so the export
is reproducible.

Run this first to produce `spike_model.pt`, then run `export.py`.
"""

from __future__ import annotations

import random
from pathlib import Path

import numpy as np
import torch
from torch import nn

SEED = 42
INPUT_DIM = 13  # must match ml/MODEL_SPEC.md
PT_PATH = Path(__file__).resolve().parent / "spike_model.pt"


def _seed_everything(seed: int = SEED) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


class SpikeMLP(nn.Module):
    """5-layer MLP: 13 -> 64 -> 32 -> 16 -> 8 -> 1. Regression output (1 scalar)."""

    def __init__(self, input_dim: int = INPUT_DIM) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.ReLU(),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 8),
            nn.ReLU(),
            nn.Linear(8, 1),  # raw focus minutes; clamped to 15-90 post-inference
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


def build_model() -> SpikeMLP:
    """Return a deterministically-seeded model in eval mode."""
    _seed_everything()
    model = SpikeMLP()
    model.eval()
    return model


def make_representative_dataset(n: int = 128) -> np.ndarray:
    """Fake normalized feature vectors in [0, 1]. Used for INT8 calibration on the
    real model (M5.3); not needed for the spike's float32 path."""
    _seed_everything()
    return np.random.rand(n, INPUT_DIM).astype(np.float32)


if __name__ == "__main__":
    model = build_model()
    torch.save(model.state_dict(), PT_PATH)
    n_params = sum(p.numel() for p in model.parameters())
    print(f"[dummy_model] saved {PT_PATH} ({n_params} params, input_dim={INPUT_DIM})")
