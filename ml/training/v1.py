"""Floq timer model v1 — training (M5.3).

PIPELINE-PROOF, NOT AN ACCURACY PROJECT (decisions.md O11). There is no real
user data in W1–W5, so v1 is trained on SYNTHETIC data: random session contexts
whose target focus-minutes come from the cold-start formula + Gaussian noise. The
model just relearns the (feature-visible part of the) formula — its job is to
prove the PyTorch -> ONNX -> TFLite -> on-device path end to end with the real
13-dim feature vector and the production architecture, so the regime router has a
real `floq-timer-v1.tflite` to route the mature regime to. Real beta data retrains
this before TestFlight expands (ml/CLAUDE.md). SYNTHETIC-ONLY is flagged in
decisions.md O11.

Architecture + feature vector are LOCKED in ml/MODEL_SPEC.md:
  - input: 13-dim normalized feature vector (see `encode_features`)
  - model: 3-layer MLP 13 -> 32 -> 16 -> 1 (production; the spike used 5 layers)
  - output: a single scalar (raw focus minutes; clamped 15-90 post-inference in TS)

Run: `conda run -n floq-ml python ml/training/v1.py` -> writes floq_timer_v1.pt
+ floq_timer_v1.metadata.json. Then `python ml/export/v1_export.py`.
"""

from __future__ import annotations

import hashlib
import json
import random
import subprocess
from pathlib import Path

import numpy as np
import torch
from torch import nn

SEED = 42
INPUT_DIM = 13  # LOCKED — must match ml/MODEL_SPEC.md and the mobile feature encoder
HERE = Path(__file__).resolve().parent
PT_PATH = HERE / "floq_timer_v1.pt"
META_PATH = HERE / "floq_timer_v1.metadata.json"

# Synthetic-target hyperparameters (NOT the production formula — that lives,
# frozen, in mobile/services/timer/coldStart.ts). These mirror timer.md's
# cold-start factors only to fabricate plausible labels for the plumbing model.
N_SAMPLES = 20_000
N_EPOCHS = 300
BATCH_SIZE = 256
LR = 1e-3
TARGET_NOISE_SD = 3.0  # minutes — keeps the model from memorizing an exact map
FOCUS_MIN, FOCUS_MAX = 15.0, 90.0

HOUR_BUCKETS = ("morning", "afternoon", "evening", "night")
PREFERRED_TIMES = ("morning", "afternoon", "evening")
DISTRACTION_MODS = {"easy": 0.8, "neutral": 1.0, "hard": 1.15}


def _seed_everything(seed: int = SEED) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


def encode_features(raw: dict) -> np.ndarray:
    """raw session context -> 13-dim normalized vector, EXACTLY per MODEL_SPEC.md.

    This normalization is the contract: the mobile encoder
    (mobile/services/ml/featureVector.ts) must reproduce it bit-for-bit, or the
    on-device model receives inputs from a different distribution than it trained
    on. Keep the two in lockstep.
    """
    def clamp(v: float, lo: float, hi: float) -> float:
        return max(lo, min(hi, v))

    hb = raw["hour_bucket"]
    dow = raw["day_of_week"]
    rfa = raw["recent_focus_avg"]
    rdr = raw["recent_distract_rate"]
    base_decayed = raw["base_focus"] * raw["decay_weight"]

    return np.array(
        [
            (raw["task_difficulty"] - 1) / 4,                       # 0
            (clamp(raw["task_est_minutes"], 5, 180) - 5) / 175,     # 1
            1.0 if hb == "morning" else 0.0,                        # 2
            1.0 if hb == "afternoon" else 0.0,                      # 3
            1.0 if hb == "evening" else 0.0,                        # 4
            1.0 if hb == "night" else 0.0,                          # 5
            (np.sin(2 * np.pi * dow / 7) + 1) / 2,                  # 6
            (np.cos(2 * np.pi * dow / 7) + 1) / 2,                  # 7
            clamp(raw["sessions_today"], 0, 10) / 10,               # 8
            clamp(raw["hours_since_last"], 0, 48) / 48,             # 9
            clamp(rfa if rfa is not None else 0, 0, 90) / 90,       # 10
            clamp(rdr if rdr is not None else 0, 0, 5) / 5,         # 11
            clamp(base_decayed, 10, 90) / 90,                       # 12
        ],
        dtype=np.float32,
    )


def _synthetic_target(raw: dict, rng: np.random.Generator) -> float:
    """Cold-start focus minutes (timer.md factors) + noise, clamped 15-90.

    Factors the 13-dim vector does NOT observe (distraction_level, the
    hour-vs-preferred time match) become irreducible noise the model averages
    over — acceptable for a pipeline-proof synthetic model (O11)."""
    difficulty_mod = 0.85 if raw["task_difficulty"] >= 4 else 1.0
    time_match_mod = 1.0 if raw["hour_bucket"] == raw["preferred_time"] else 0.85
    fatigue_mod = (1.0, 0.9, 0.8)[min(raw["sessions_today"], 2)]
    distraction_mod = DISTRACTION_MODS[raw["distraction_level"]]
    focus = (
        raw["base_focus"]
        * distraction_mod
        * difficulty_mod
        * time_match_mod
        * fatigue_mod
    )
    focus += rng.normal(0, TARGET_NOISE_SD)
    return float(np.clip(focus, FOCUS_MIN, FOCUS_MAX))


def make_dataset(n: int = N_SAMPLES) -> tuple[np.ndarray, np.ndarray]:
    """Sample n random session contexts, encode to features, label with the
    synthetic target. Returns (X[n,13] float32, y[n,1] float32)."""
    rng = np.random.default_rng(SEED)
    X = np.empty((n, INPUT_DIM), dtype=np.float32)
    y = np.empty((n, 1), dtype=np.float32)
    for i in range(n):
        raw = {
            "task_difficulty": int(rng.integers(1, 6)),       # 1..5
            "task_est_minutes": float(rng.uniform(5, 180)),
            "hour_bucket": HOUR_BUCKETS[int(rng.integers(0, 4))],
            "preferred_time": PREFERRED_TIMES[int(rng.integers(0, 3))],
            "distraction_level": ("easy", "neutral", "hard")[int(rng.integers(0, 3))],
            "day_of_week": int(rng.integers(0, 7)),
            "sessions_today": int(rng.integers(0, 6)),
            "hours_since_last": float(rng.uniform(0, 48)),
            "recent_focus_avg": float(rng.uniform(0, 90)),
            "recent_distract_rate": float(rng.uniform(0, 5)),
            "base_focus": float(rng.uniform(10, 90)),
            "decay_weight": float(rng.uniform(0, 1)),
        }
        X[i] = encode_features(raw)
        y[i] = _synthetic_target(raw, rng)
    return X, y


class TimerMLP(nn.Module):
    """Production v1: 3-layer MLP 13 -> 32 -> 16 -> 1 (MODEL_SPEC.md)."""

    def __init__(self, input_dim: int = INPUT_DIM) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 32),
            nn.ReLU(),
            nn.Linear(32, 16),
            nn.ReLU(),
            nn.Linear(16, 1),  # raw focus minutes; clamped 15-90 post-inference in TS
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


def build_model() -> TimerMLP:
    """Seeded model in eval mode (shared with v1_export.py for load_state_dict)."""
    _seed_everything()
    model = TimerMLP()
    model.eval()
    return model


def _git_sha() -> str:
    try:
        return (
            subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=HERE)
            .decode()
            .strip()
        )
    except Exception:
        return "unknown"


def main() -> None:
    _seed_everything()
    X, y = make_dataset()

    # 90/10 train/eval split (held-out MAE is the honest "did it learn" metric).
    n_eval = N_SAMPLES // 10
    Xtr, ytr = X[:-n_eval], y[:-n_eval]
    Xev, yev = X[-n_eval:], y[-n_eval:]
    Xtr_t, ytr_t = torch.from_numpy(Xtr), torch.from_numpy(ytr)
    Xev_t, yev_t = torch.from_numpy(Xev), torch.from_numpy(yev)

    model = TimerMLP()
    model.train()
    opt = torch.optim.Adam(model.parameters(), lr=LR)
    loss_fn = nn.MSELoss()

    n = Xtr_t.shape[0]
    for epoch in range(N_EPOCHS):
        perm = torch.randperm(n)
        for start in range(0, n, BATCH_SIZE):
            idx = perm[start : start + BATCH_SIZE]
            opt.zero_grad()
            loss = loss_fn(model(Xtr_t[idx]), ytr_t[idx])
            loss.backward()
            opt.step()

    model.eval()
    with torch.no_grad():
        eval_mae = float(torch.mean(torch.abs(model(Xev_t) - yev_t)))
        eval_rmse = float(torch.sqrt(torch.mean((model(Xev_t) - yev_t) ** 2)))

    torch.save(model.state_dict(), PT_PATH)
    n_params = sum(p.numel() for p in model.parameters())

    meta = {
        "model_version": "v1",
        "synthetic": True,
        "note": "Trained on synthetic cold-start data only (O11). Retrain on real beta data before TestFlight expands.",
        "architecture": "MLP 13->32->16->1 ReLU",
        "input_dim": INPUT_DIM,
        "params": n_params,
        "seed": SEED,
        "n_samples": N_SAMPLES,
        "n_epochs": N_EPOCHS,
        "batch_size": BATCH_SIZE,
        "lr": LR,
        "target_noise_sd": TARGET_NOISE_SD,
        "eval_mae_minutes": round(eval_mae, 4),
        "eval_rmse_minutes": round(eval_rmse, 4),
        "data_sha256": hashlib.sha256(X.tobytes() + y.tobytes()).hexdigest()[:16],
        "git_sha": _git_sha(),
    }
    META_PATH.write_text(json.dumps(meta, indent=2) + "\n")

    print(f"[train] saved {PT_PATH} ({n_params} params, input_dim={INPUT_DIM})")
    print(f"[train] held-out MAE = {eval_mae:.2f} min, RMSE = {eval_rmse:.2f} min")
    print(f"[train] wrote {META_PATH}")


if __name__ == "__main__":
    main()
