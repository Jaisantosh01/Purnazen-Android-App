"""Fine-tune YOLOv8 on TCM-Tongue (arXiv:2507.18288) for the 21 tongue findings.

Runs as a Kaggle GPU kernel (see kernel-metadata.json next to this file) or
locally with ``--data-root``. Outputs land in ``--out`` (``/kaggle/working`` on
Kaggle):

    tongue_tcm_yolov8n.pt     best checkpoint (ultralytics format)
    tongue_tcm_yolov8n.onnx   same graph, opset 12, 640x640, for onnxruntime
    classes.json              id → pinyin → english, in training order
    metrics.json              mAP50 / mAP50-95 overall and per class

Dataset on Kaggle: obaidulhaque/tmc-tongue-dataset (a mirror of the Dryad
release, DOI 10.5061/dryad.1c59zw48r). Its README says 20 classes; the COCO
categories say 21 and a handful of test annotations carry id 21 — so ``nc``
comes from the categories file and out-of-range label ids are dropped.

Kaggle:   kaggle kernels push -p backend/ml/tongue && kaggle kernels status <ref>
Local:    python train_tongue_yolo.py --data-root ~/data/shezhen --epochs 1 --model yolov8n.pt
"""
import argparse
import glob
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

# Pinyin class names (dataset order) → English. 舌 = tongue body, 苔 = coat,
# 凹/凸 = organ-zone depression/bulge (kidney, liver-gallbladder, spleen-stomach,
# heart-lung). ``huataishe`` is 滑苔 (slippery coat) — the closest thing in this
# dataset to the "greasy" head the app exposes.
ENGLISH = {
    "jiankangshe": "healthy",          "botaishe":   "thin_coat",
    "hongshe":     "red_body",         "zishe":      "purple_body",
    "pangdashe":   "swollen_body",     "shoushe":    "thin_body",
    "hongdianshe": "red_dots",         "liewenshe":  "cracks",
    "chihenshe":   "tooth_marks",      "baitaishe":  "white_coat",
    "huangtaishe": "yellow_coat",      "heitaishe":  "black_coat",
    "huataishe":   "slippery_coat",
    "shenquao":    "kidney_zone_concave",  "shenqutu":  "kidney_zone_convex",
    "gandanao":    "liver_gb_zone_concave", "gandantu": "liver_gb_zone_convex",
    "piweiao":     "spleen_zone_concave",  "piweitu":   "spleen_zone_convex",
    "xinfeiao":    "heartlung_zone_concave", "xinfeitu": "heartlung_zone_convex",
}


def _pip(*pkgs):
    subprocess.check_call([sys.executable, "-m", "pip", "install", "-q", *pkgs])


def find_split_root(data_root: str) -> Path:
    """Locate the YOLO-txt layout: <root>/{train,val,test}/{images,labels}."""
    roots = [Path(p).parent.parent
             for p in glob.glob(os.path.join(data_root, "**", "train", "labels"), recursive=True)]
    roots = [r for r in roots if (r / "train" / "images").is_dir() and (r / "val" / "images").is_dir()]
    if not roots:
        raise SystemExit(f"no train/{{images,labels}} layout under {data_root}")
    # Prefer the txt (YOLO) tree over the coco/xml siblings.
    return next((r for r in roots if "txt" in str(r).lower()), roots[0])


def load_classes(data_root: str) -> list[str]:
    """Class names in id order from the COCO categories (authoritative), else classes.txt."""
    for j in glob.glob(os.path.join(data_root, "**", "annotations", "*.json"), recursive=True):
        cats = json.load(open(j)).get("categories")
        if cats:
            return [c["name"] for c in sorted(cats, key=lambda c: c["id"])]
    for t in glob.glob(os.path.join(data_root, "**", "classes.txt"), recursive=True):
        return [ln.strip() for ln in open(t) if ln.strip()]
    raise SystemExit("no categories json or classes.txt found")


def stage_dataset(split_root: Path, names: list[str], work: Path) -> Path:
    """Copy labels into ``work`` dropping ids ≥ nc; images are referenced in place."""
    nc = len(names)
    dropped = 0
    for split in ("train", "val", "test"):
        src_lbl = split_root / split / "labels"
        if not src_lbl.is_dir():
            continue
        dst_lbl = work / split / "labels"
        dst_lbl.mkdir(parents=True, exist_ok=True)
        img_link = work / split / "images"
        if not img_link.exists():
            img_link.symlink_to(split_root / split / "images", target_is_directory=True)
        for f in src_lbl.glob("*.txt"):
            keep = []
            for ln in open(f):
                parts = ln.split()
                if len(parts) >= 5 and int(float(parts[0])) < nc:
                    keep.append(ln)
                elif parts:
                    dropped += 1
            (dst_lbl / f.name).write_text("".join(keep))
    print(f"staged labels into {work} (nc={nc}, dropped {dropped} out-of-range boxes)")
    yaml = work / "data.yaml"
    yaml.write_text(
        f"path: {work}\ntrain: train/images\nval: val/images\n"
        + (f"test: test/images\n" if (work / "test").exists() else "")
        + f"nc: {nc}\nnames: {json.dumps(names)}\n"
    )
    return yaml


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data-root", default="/kaggle/input")
    ap.add_argument("--out", default="/kaggle/working")
    ap.add_argument("--model", default="yolov8n.pt")
    ap.add_argument("--epochs", type=int, default=40)
    ap.add_argument("--imgsz", type=int, default=640)
    ap.add_argument("--batch", type=int, default=32)
    args = ap.parse_args()

    try:
        import ultralytics  # noqa: F401
    except ImportError:
        _pip("ultralytics>=8.3", "onnx", "onnxslim")
    from ultralytics import YOLO

    out = Path(args.out); out.mkdir(parents=True, exist_ok=True)
    work = out / "dataset"
    # Show the mount layout in the log — Kaggle's input path is not always the slug.
    for dirpath, dirnames, filenames in os.walk(args.data_root):
        depth = dirpath[len(args.data_root):].count(os.sep)
        if depth <= 4:
            print(f"{'  ' * depth}{os.path.basename(dirpath) or args.data_root}/  ({len(filenames)} files)")
        if depth >= 4:
            dirnames[:] = []
    names = load_classes(args.data_root)
    yaml = stage_dataset(find_split_root(args.data_root), names, work)
    json.dump([{"id": i, "pinyin": n, "english": ENGLISH.get(n, n)} for i, n in enumerate(names)],
              open(out / "classes.json", "w"), indent=2)

    model = YOLO(args.model)
    model.train(data=str(yaml), epochs=args.epochs, imgsz=args.imgsz, batch=args.batch,
                project=str(out / "runs"), name="tongue_tcm", exist_ok=True,
                patience=10, seed=0, deterministic=True, plots=False, verbose=False)

    best = Path(model.trainer.best)
    stem = f"tongue_tcm_{Path(args.model).stem}"
    shutil.copy(best, out / f"{stem}.pt")

    # Per-class metrics on the val split (the paper's own benchmarks are on val too).
    m = YOLO(str(best)).val(data=str(yaml), imgsz=args.imgsz, plots=False, verbose=False)
    per_class = {names[int(i)]: {"map50": float(m.box.ap50[k]), "map50_95": float(m.box.ap[k])}
                 for k, i in enumerate(m.box.ap_class_index)}
    json.dump({"map50": float(m.box.map50), "map50_95": float(m.box.map),
               "epochs": args.epochs, "model": args.model, "per_class": per_class},
              open(out / "metrics.json", "w"), indent=2)
    print(json.dumps({"map50": float(m.box.map50), "map50_95": float(m.box.map)}, indent=1))
    for k in ("cracks", "tooth_marks", "slippery_coat", "red_body", "purple_body", "yellow_coat", "swollen_body", "thin_body"):
        pin = next((p for p, e in ENGLISH.items() if e == k), None)
        if pin in per_class:
            print(f"  {k:16s} mAP50={per_class[pin]['map50']:.3f}")

    onnx_path = YOLO(str(best)).export(format="onnx", imgsz=args.imgsz, opset=12, simplify=True, dynamic=False)
    shutil.copy(onnx_path, out / f"{stem}.onnx")
    shutil.rmtree(work, ignore_errors=True)          # don't ship 6k symlinked images as output
    print("done:", sorted(p.name for p in out.iterdir()))


if __name__ == "__main__":
    main()
