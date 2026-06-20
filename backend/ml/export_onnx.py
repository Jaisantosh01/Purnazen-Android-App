"""Stage 3 — export a trained checkpoint to ONNX for backend inference.

Writes ``backend/app/ai/models/skin_model.onnx`` (the path app/ai/skin_model.py
loads) and verifies torch vs ONNX-Runtime numerical parity.

Usage:
    python export_onnx.py --ckpt checkpoints/best.pt
    python export_onnx.py --smoke      # export a randomly-init model, prove the path
"""
from __future__ import annotations

import argparse
import os

from common import INPUT_SIZE, METRIC_ORDER

# backend/ml/.. -> backend/app/ai/models/skin_model.onnx
_DEFAULT_OUT = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "app", "ai", "models", "skin_model.onnx")
)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", default="checkpoints/best.pt")
    ap.add_argument("--out", default=_DEFAULT_OUT)
    ap.add_argument("--smoke", action="store_true", help="export a random-init model (no ckpt)")
    args = ap.parse_args()

    try:
        import numpy as np
        import torch
    except ImportError:
        raise SystemExit("PyTorch not installed. `pip install -r requirements-train.txt`")

    from train import build_model

    # A sigmoid wrapper so the exported graph outputs 0..1 directly (matches
    # app/ai/skin_model.py, which does NOT apply sigmoid itself).
    class Wrapped(torch.nn.Module):
        def __init__(self, net):
            super().__init__()
            self.net = net

        def forward(self, x):
            return torch.sigmoid(self.net(x))

    if args.smoke:
        net = build_model(pretrained=False)
    else:
        ckpt = torch.load(args.ckpt, map_location="cpu")
        net = build_model(pretrained=False)
        net.load_state_dict(ckpt["state_dict"])
    model = Wrapped(net).eval()

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    dummy = torch.randn(1, 3, INPUT_SIZE, INPUT_SIZE)
    torch.onnx.export(
        model, dummy, args.out,
        input_names=["input"], output_names=["scores"],
        dynamic_axes={"input": {0: "batch"}, "scores": {0: "batch"}},
        opset_version=17,
    )
    print(f"Exported → {args.out}  (heads: {len(METRIC_ORDER)})")

    # Parity check against onnxruntime, if available.
    try:
        import onnxruntime as ort
        with torch.no_grad():
            torch_out = model(dummy).numpy()
        sess = ort.InferenceSession(args.out, providers=["CPUExecutionProvider"])
        onnx_out = sess.run(None, {"input": dummy.numpy()})[0]
        max_diff = float(np.abs(torch_out - onnx_out).max())
        print(f"torch vs onnx max abs diff: {max_diff:.2e}", "OK" if max_diff < 1e-4 else "WARN")
    except ImportError:
        print("onnxruntime not installed — skipped parity check (export still written).")


if __name__ == "__main__":
    main()
