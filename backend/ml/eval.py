"""Stage 4 — evaluate a trained checkpoint on the held-out test split.

Reports per-head MAE (0..100) and Pearson + Spearman correlation against the
labels. This is the validation gate: only promote the model into the backend
(export_onnx → app/ai/models/) once it clearly beats the classical-CV baseline
on these numbers. (CV baseline can be measured by running app/ai/analyzers on the
same crops — see README.)

Usage:
    python eval.py --data data/prepared --ckpt checkpoints/best.pt
"""
from __future__ import annotations

import argparse
import os

from common import METRIC_ORDER, SCORE_MAX


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/prepared")
    ap.add_argument("--ckpt", default="checkpoints/best.pt")
    ap.add_argument("--batch", type=int, default=32)
    args = ap.parse_args()

    try:
        import numpy as np
        import torch
        from torch.utils.data import DataLoader
    except ImportError:
        raise SystemExit("PyTorch not installed. `pip install -r requirements-train.txt`")

    from train import CsvSkinDataset, build_model

    device = "cuda" if torch.cuda.is_available() else "cpu"
    ds = CsvSkinDataset(os.path.join(args.data, "test.csv"))
    loader = DataLoader(ds, batch_size=args.batch)

    ckpt = torch.load(args.ckpt, map_location=device)
    net = build_model(pretrained=False).to(device)
    net.load_state_dict(ckpt["state_dict"])
    net.eval()

    preds, targets, masks = [], [], []
    with torch.no_grad():
        for x, target, mask in loader:
            out = torch.sigmoid(net(x.to(device))).cpu().numpy()
            preds.append(out); targets.append(target.numpy()); masks.append(mask.numpy())
    P = np.concatenate(preds) * SCORE_MAX
    T = np.concatenate(targets) * SCORE_MAX
    M = np.concatenate(masks).astype(bool)

    try:
        from scipy.stats import pearsonr, spearmanr
        have_scipy = True
    except ImportError:
        have_scipy = False

    print(f"\n{'metric':<20}{'n':>6}{'MAE':>8}{'Pearson':>10}{'Spearman':>10}")
    print("-" * 54)
    for i, metric in enumerate(METRIC_ORDER):
        sel = M[:, i]
        n = int(sel.sum())
        if n < 2:
            print(f"{metric:<20}{n:>6}{'—':>8}{'—':>10}{'—':>10}  (unlabeled)")
            continue
        p, t = P[sel, i], T[sel, i]
        mae = float(np.abs(p - t).mean())
        if have_scipy:
            pear = pearsonr(p, t)[0]
            spear = spearmanr(p, t)[0]
            print(f"{metric:<20}{n:>6}{mae:>8.1f}{pear:>10.2f}{spear:>10.2f}")
        else:
            print(f"{metric:<20}{n:>6}{mae:>8.1f}{'(scipy?)':>10}{'(scipy?)':>10}")


if __name__ == "__main__":
    main()
