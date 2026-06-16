"""Stage 2 — train the multi-head skin-scoring model.

A MobileNetV3-Small backbone with a 9-output regression head (sigmoid → 0..1,
scaled to 0..100). Partially-labeled datasets are handled with a per-metric mask:
unlabeled heads contribute nothing to the loss, so you can train oiliness/pores/
wrinkles/pigmentation now and add the rest as more data arrives.

Usage:
    python train.py --data data/prepared --epochs 30 --batch 32 [--no-pretrained]
    python train.py --smoke          # tiny synthetic run, no dataset needed

The --smoke run proves the full forward/backward/save loop end-to-end (used to
validate the scaffold before plugging in the real dataset).
"""
from __future__ import annotations

import argparse
import os

from common import INPUT_SIZE, METRIC_ORDER, SCORE_MAX


def build_model(pretrained: bool = True):
    import torch.nn as nn
    from torchvision import models

    weights = models.MobileNet_V3_Small_Weights.DEFAULT if pretrained else None
    net = models.mobilenet_v3_small(weights=weights)
    in_features = net.classifier[-1].in_features
    net.classifier[-1] = nn.Linear(in_features, len(METRIC_ORDER))
    return net


def _transform():
    from torchvision import transforms
    from common import IMAGENET_MEAN, IMAGENET_STD
    return transforms.Compose([
        transforms.Resize((INPUT_SIZE, INPUT_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize(IMAGENET_MEAN, IMAGENET_STD),
    ])


class CsvSkinDataset:
    """Reads a prepared split CSV → (image_tensor, target[9], mask[9])."""

    def __init__(self, csv_path):
        import pandas as pd
        self.df = pd.read_csv(csv_path)
        self.tf = _transform()

    def __len__(self):
        return len(self.df)

    def __getitem__(self, i):
        import torch
        from PIL import Image
        row = self.df.iloc[i]
        img = Image.open(row["filepath"]).convert("RGB")
        x = self.tf(img)
        target = torch.tensor([row[m] / SCORE_MAX for m in METRIC_ORDER], dtype=torch.float32)
        mask = torch.tensor([row[f"{m}_mask"] for m in METRIC_ORDER], dtype=torch.float32)
        return x, target, mask


class SyntheticDataset:
    """Random tensors + labels for --smoke (no files, no downloads)."""

    def __init__(self, n=24):
        self.n = n

    def __len__(self):
        return self.n

    def __getitem__(self, i):
        import torch
        x = torch.rand(3, INPUT_SIZE, INPUT_SIZE)
        target = torch.rand(len(METRIC_ORDER))
        mask = torch.ones(len(METRIC_ORDER))
        return x, target, mask


def masked_l1(pred, target, mask):
    """L1 over labeled heads only (mask=0 heads ignored)."""
    import torch
    diff = (torch.sigmoid(pred) - target).abs() * mask
    denom = mask.sum().clamp(min=1.0)
    return diff.sum() / denom


def _run_epoch(net, loader, device, optimizer=None):
    import torch
    train = optimizer is not None
    net.train(train)
    total_loss, n = 0.0, 0
    # per-head absolute error accumulation (in 0..100)
    abs_err = torch.zeros(len(METRIC_ORDER))
    counts = torch.zeros(len(METRIC_ORDER))
    for x, target, mask in loader:
        x, target, mask = x.to(device), target.to(device), mask.to(device)
        with torch.set_grad_enabled(train):
            pred = net(x)
            loss = masked_l1(pred, target, mask)
            if train:
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()
        total_loss += float(loss) * x.size(0)
        n += x.size(0)
        with torch.no_grad():
            err = (torch.sigmoid(pred) - target).abs() * mask * SCORE_MAX
            abs_err += err.sum(dim=0).cpu()
            counts += mask.sum(dim=0).cpu()
    mae = (abs_err / counts.clamp(min=1)).tolist()
    return total_loss / max(1, n), mae


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default="data/prepared")
    ap.add_argument("--epochs", type=int, default=30)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--lr", type=float, default=3e-4)
    ap.add_argument("--out", default="checkpoints")
    ap.add_argument("--no-pretrained", action="store_true")
    ap.add_argument("--smoke", action="store_true", help="tiny synthetic run, no dataset")
    args = ap.parse_args()

    try:
        import torch
        from torch.utils.data import DataLoader
    except ImportError:
        raise SystemExit("PyTorch not installed. `pip install -r requirements-train.txt`")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device}  | smoke={args.smoke}")

    if args.smoke:
        train_ds, val_ds = SyntheticDataset(24), SyntheticDataset(8)
        epochs, batch, pretrained = 2, 8, False
    else:
        train_ds = CsvSkinDataset(os.path.join(args.data, "train.csv"))
        val_ds = CsvSkinDataset(os.path.join(args.data, "val.csv"))
        epochs, batch, pretrained = args.epochs, args.batch, not args.no_pretrained

    train_loader = DataLoader(train_ds, batch_size=batch, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch)

    net = build_model(pretrained=pretrained).to(device)
    optimizer = torch.optim.AdamW(net.parameters(), lr=args.lr)

    os.makedirs(args.out, exist_ok=True)
    best_val = float("inf")
    for epoch in range(1, epochs + 1):
        tr_loss, _ = _run_epoch(net, train_loader, device, optimizer)
        va_loss, va_mae = _run_epoch(net, val_loader, device)
        mae_str = "  ".join(f"{m.split('_')[0]}:{e:.1f}" for m, e in zip(METRIC_ORDER, va_mae))
        print(f"epoch {epoch:3}/{epochs}  train_l1={tr_loss:.4f}  val_l1={va_loss:.4f}  MAE[{mae_str}]")
        if va_loss < best_val:
            best_val = va_loss
            torch.save({"state_dict": net.state_dict(), "metric_order": METRIC_ORDER,
                        "pretrained": pretrained}, os.path.join(args.out, "best.pt"))

    print(f"Best val L1={best_val:.4f}  → {os.path.join(args.out, 'best.pt')}")
    if args.smoke:
        print("SMOKE OK — forward/backward/save loop works end-to-end.")


if __name__ == "__main__":
    main()
