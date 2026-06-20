"""Stage 1 — turn a raw labeled dataset into train/val/test splits.

Reads a labels CSV or XLSX file (one row per image, severity columns 0..5),
maps the columns to our metric heads via ``common.DEFAULT_COLUMN_MAP`` (edit
for your dataset), scales 0..5 → 0..100, and writes three CSVs with one column
per metric plus a ``<metric>_mask`` (1 = labeled, 0 = unsupervised) so
partially-labeled datasets train correctly.

Usage — killa92 "Facial Skin Analysis & Type Classification" dataset:
    # 1. merge the two killa92 xlsx label files into one
    python - <<'EOF'
import pandas as pd
df = pd.concat([
    pd.read_excel("data/raw/skinalaysis_labeling_train1.xlsx"),
    pd.read_excel("data/raw/skinanalysis_valid1-2.xlsx"),
], ignore_index=True)
df.to_csv("data/raw/labels_merged.csv", index=False)
EOF

    # 2. run prepare_dataset (--image-col matches the xlsx "file_name" column)
    python prepare_dataset.py \
        --labels data/raw/labels_merged.csv \
        --images-root data/raw/images \
        --image-col file_name \
        --out data/prepared

Generic usage:
    python prepare_dataset.py \
        --labels data/raw/labels.csv \      # .csv or .xlsx accepted
        --images-root data/raw/images \
        --out data/prepared \
        [--image-col filename] [--val-frac 0.15] [--test-frac 0.15] [--seed 42]

No face alignment is done here (train.py aligns on the fly so you can re-align
without re-preparing). The output ``filepath`` column is absolute.
"""
from __future__ import annotations

import argparse
import os

from common import DEFAULT_COLUMN_MAP, METRIC_ORDER, severity_to_score


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--labels", required=True, help="CSV or XLSX with image filename + severity columns")
    ap.add_argument("--images-root", required=True, help="Folder the filename column is relative to")
    ap.add_argument("--out", default="data/prepared", help="Output folder for the split CSVs")
    ap.add_argument("--image-col", default="filename", help="Column holding the image filename")
    ap.add_argument("--val-frac", type=float, default=0.15)
    ap.add_argument("--test-frac", type=float, default=0.15)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    import numpy as np
    import pandas as pd

    if args.labels.endswith((".xlsx", ".xls")):
        df = pd.read_excel(args.labels)
    else:
        df = pd.read_csv(args.labels)
    if args.image_col not in df.columns:
        raise SystemExit(f"--image-col '{args.image_col}' not in {list(df.columns)}")

    out = pd.DataFrame()
    out["filepath"] = df[args.image_col].apply(
        lambda fn: os.path.abspath(os.path.join(args.images_root, str(fn)))
    )

    mapped = 0
    for col, spec in DEFAULT_COLUMN_MAP.items():
        metric = spec["metric"]
        if col in df.columns:
            out[metric] = df[col].apply(lambda v: severity_to_score(v, spec.get("invert", False)))
            out[f"{metric}_mask"] = df[col].notna().astype(int)
            mapped += 1
    # Fill unmapped metrics with neutral value + mask 0 (ignored by the loss).
    for metric in METRIC_ORDER:
        if metric not in out.columns:
            out[metric] = 50.0
            out[f"{metric}_mask"] = 0

    print(f"Mapped {mapped} label columns → metrics:",
          [m for m in METRIC_ORDER if f"{m}_mask" in out and out[f"{m}_mask"].max() == 1])

    # Drop rows whose image file is missing.
    exists = out["filepath"].apply(os.path.exists)
    if (~exists).any():
        print(f"Dropping {int((~exists).sum())} rows with missing image files")
    out = out[exists].reset_index(drop=True)
    if out.empty:
        raise SystemExit("No usable rows — check --images-root / filenames.")

    # Shuffle + split.
    rng = np.random.default_rng(args.seed)
    idx = rng.permutation(len(out))
    n_test = int(len(out) * args.test_frac)
    n_val = int(len(out) * args.val_frac)
    test_idx, val_idx, train_idx = idx[:n_test], idx[n_test:n_test + n_val], idx[n_test + n_val:]

    os.makedirs(args.out, exist_ok=True)
    for name, sel in (("train", train_idx), ("val", val_idx), ("test", test_idx)):
        path = os.path.join(args.out, f"{name}.csv")
        out.iloc[sel].to_csv(path, index=False)
        print(f"  {name:5} {len(sel):6} rows → {path}")


if __name__ == "__main__":
    main()
