# Skin-analysis model — training project

Trains the multi-head CNN that scores face scans. The FastAPI backend runs the
**exported ONNX** model (`app/ai/skin_model.py`); this folder is where you
**train and export** it. Everything here runs *offline / on Colab* — it is not
imported by the running server (the server only needs `onnxruntime`).

> **Why this exists:** the original 9 analyzers were uncalibrated heuristics
> (e.g. oily skin scored *low* oiliness). A model trained on labeled data and
> validated on a held-out test set replaces them once it demonstrably beats the
> classical-CV baseline. Until then the backend falls back to the (now
> recalibrated) CV analyzers automatically.

## Pipeline

```
prepare_dataset.py  →  train.py  →  eval.py  →  export_onnx.py
   (split CSVs)        (best.pt)   (validate)   (skin_model.onnx → backend)
```

## 0. Environment (separate from the backend runtime)

```bash
cd backend/ml
python -m venv .venv-train
# Windows: .venv-train\Scripts\activate    | *nix: source .venv-train/bin/activate
pip install -r requirements-train.txt      # for CUDA, install torch from pytorch.org
```

## 1. Get a dataset

### Primary dataset — Kaggle "Facial Skin Analysis & Type Classification" (killa92)

This is the dataset `common.DEFAULT_COLUMN_MAP` is already wired for. It
provides 0–5 severity labels for **6 of our 9 metric heads**: oiliness, pores,
wrinkles, pigmentation, acne (inflammation proxy), and dark circles. The
remaining 3 (`hydration_score`, `elasticity_score`, `muscle_tone_score`) will
be masked out of the loss and continue using the CV analyzer until a dataset
labels them.

```
https://www.kaggle.com/datasets/killa92/facial-skin-analysis-and-type-classification
```

**What's in it:**
- ~4,093 face images (640×640)
- 2 Excel label files: `skinalaysis_labeling_train1.xlsx` (~150 labeled rows)
  and `skinanalysis_valid1-2.xlsx` (~50 labeled rows); the rest of the images
  are unlabeled. Small but real, and the masked-loss design handles it.
- Severity columns 0–5 (matching `common.SEVERITY_MAX`)

**Download (needs `~/.kaggle/kaggle.json` API token):**

```bash
kaggle datasets download -d killa92/facial-skin-analysis-and-type-classification \
    -p data/raw --unzip
```

### Supplementary — GlowMix (35k images, classification labels)

```
https://www.kaggle.com/datasets/drishyatomar/glowmix-merged-facial-skincare-dataset
```

GlowMix covers pores, wrinkles, dark spots, and acne at scale (~35k images),
but its labels are class categories, not 0–5 severity scores. To use it
alongside killa92, map the class labels to a severity proxy before running
`prepare_dataset.py` (e.g. class 0 = 0, class 1 = 2, class 2 = 4, class 3 = 5)
and add the columns to `DEFAULT_COLUMN_MAP`.

### Editing `DEFAULT_COLUMN_MAP` for other datasets

Open `common.py` and update `DEFAULT_COLUMN_MAP` so its keys match your CSV's
actual column names. Metrics with no mapped column are left **unsupervised**
(masked out of the loss) and fall back to the CV analyzer until you label them.

## 2. Prepare splits

**killa92 — merge the two xlsx label files first, then prepare:**

```bash
# Step 1: merge train + val xlsx into one CSV
python - <<'EOF'
import pandas as pd
df = pd.concat([
    pd.read_excel("data/raw/skinalaysis_labeling_train1.xlsx"),
    pd.read_excel("data/raw/skinanalysis_valid1-2.xlsx"),
], ignore_index=True)
df.to_csv("data/raw/labels_merged.csv", index=False)
print(f"Merged {len(df)} labeled rows.")
EOF

# Step 2: prepare train/val/test splits
python prepare_dataset.py \
    --labels data/raw/labels_merged.csv \
    --images-root data/raw/images \
    --image-col file_name \
    --out data/prepared
```

For other datasets with a single label file:

```bash
python prepare_dataset.py --labels data/raw/labels.csv --images-root data/raw/images --out data/prepared
```

Both `.csv` and `.xlsx` files are accepted directly.

Produces `data/prepared/{train,val,test}.csv` with one `<metric>` + `<metric>_mask`
column per head.

## 3. Train

```bash
python train.py --data data/prepared --epochs 30 --batch 32
# scaffold sanity check (no dataset, no downloads):
python train.py --smoke
```

Best checkpoint → `checkpoints/best.pt`. Watch per-head val **MAE** (0..100).

## 4. Evaluate (the validation gate)

```bash
python eval.py --data data/prepared --ckpt checkpoints/best.pt
```

Prints per-head MAE + Pearson/Spearman vs labels. **Only export to the backend
once the model clearly beats CV.** Measure the CV baseline by running the
classical analyzers (`backend/app/ai/analyzers/`) on the same test crops — see
`backend/sandbox/test_analyzers.py` and `ml_pipeline.ipynb` for the harness.

## 5. Export to the backend

```bash
python export_onnx.py --ckpt checkpoints/best.pt
# writes backend/app/ai/models/skin_model.onnx + checks torch↔onnx parity
```

Restart the backend — `app/ai/skin_model.py` picks the file up automatically and
the pipeline switches `scoring_method` from `"cv"` to `"model"`.

## Contract (keep in sync with `app/ai/skin_model.py`)

- Input `1×3×224×224` float32, RGB, aligned face crop, ImageNet-normalized.
- Output `1×9` float32 in `[0,1]`, in `common.METRIC_ORDER`.
- `export_onnx.py` bakes the final `sigmoid` into the graph; the backend does
  **not** re-apply it.
