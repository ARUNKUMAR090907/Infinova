#!/usr/bin/env python3
"""
Evaluate the trained INFINOVAU-Net model on the held-out test split.
Calculates Accuracy, Precision, Recall, F1 score, IoU, and Dice coefficient.
"""
from __future__ import annotations

import json
import random
import sys
from pathlib import Path

import cv2
import numpy as np
import torch
from PIL import Image
from torch.utils.data import DataLoader, Dataset

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.models.unet import UNet


class TestDataset(Dataset):
    def __init__(self, pairs: list[tuple[Path, Path]]):
        self.pairs = pairs

    def __len__(self):
        return len(self.pairs)

    def __getitem__(self, idx):
        img_p, mask_p = self.pairs[idx]
        img = np.array(Image.open(img_p).convert("L"), dtype=np.float32) / 255.0
        mask = np.array(Image.open(mask_p).convert("L"), dtype=np.float32)
        mask = (mask > 127).astype(np.float32)

        if img.shape != (256, 256):
            img = cv2.resize(img, (256, 256))
        if mask.shape != (256, 256):
            mask = cv2.resize(mask, (256, 256), interpolation=cv2.INTER_NEAREST)

        x = torch.from_numpy(img[None, ...])
        y = torch.from_numpy(mask[None, ...])
        return x, y


def compute_metrics(preds: torch.Tensor, targets: torch.Tensor, eps: float = 1e-6) -> dict:
    pb = (preds > 0.5).float()
    tb = (targets > 0.5).float()

    tp = (pb * tb).sum()
    fp = (pb * (1 - tb)).sum()
    fn = ((1 - pb) * tb).sum()
    tn = ((1 - pb) * (1 - tb)).sum()

    total = tp + fp + fn + tn
    accuracy = float((tp + tn) / (total + eps))
    precision = float((tp + eps) / (tp + fp + eps))
    recall = float((tp + eps) / (tp + fn + eps))
    f1 = float((2 * precision * recall) / (precision + recall + eps))

    inter = tp
    union = tp + fp + fn
    iou = float((inter + eps) / (union + eps))
    dice = float((2 * inter + eps) / (pb.sum() + tb.sum() + eps))

    return {
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "iou": round(iou, 4),
        "dice": round(dice, 4),
    }


def main():
    weights_path = ROOT / "ml" / "weights" / "unet_oilspill.pt"
    if not weights_path.exists():
        print(f"Weights file not found: {weights_path}")
        sys.exit(1)

    images_dir = ROOT / "data" / "training" / "images"
    masks_dir = ROOT / "data" / "training" / "masks"
    pairs = []
    for img_p in sorted(images_dir.glob("*.png")):
        mask_p = masks_dir / img_p.name
        if mask_p.exists():
            pairs.append((img_p, mask_p))

    if not pairs:
        print("No paired images/masks found in data/training/")
        sys.exit(1)

    # Use reproducible 42 seed to get test split (15%)
    random.seed(42)
    random.shuffle(pairs)
    n = len(pairs)
    test_pairs = pairs[int(n * 0.85):]

    test_ds = TestDataset(test_pairs)
    test_loader = DataLoader(test_ds, batch_size=4, shuffle=False)

    model = UNet(in_channels=1, out_channels=1, base=16)
    state = torch.load(weights_path, map_location="cpu")
    model.load_state_dict(state)
    model.eval()

    test_preds, test_targets = [], []
    with torch.no_grad():
        for x, y in test_loader:
            pred = model(x)
            test_preds.append(pred)
            test_targets.append(y)

    metrics = compute_metrics(torch.cat(test_preds, dim=0), torch.cat(test_targets, dim=0))

    report = {
        "model": "INFINOVAU-Net Segmentation",
        "checkpoint": str(weights_path.relative_to(ROOT)),
        "test_samples_evaluated": len(test_pairs),
        "total_dataset_size": len(pairs),
        "metrics": metrics,
        "class_performance": {
            "oil_spill": {
                "dice": metrics["dice"],
                "iou": metrics["iou"],
                "precision": metrics["precision"],
                "recall": metrics["recall"],
            },
            "background_sea": {
                "accuracy": metrics["accuracy"],
            }
        },
        "evaluation_notes": (
            "Metrics computed on independent test split. "
            "Dice and IoU prioritize positive oil-spill pixels over sea background."
        )
    }

    out_path = ROOT / "reports" / "model_metrics.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Evaluation complete! Metrics written to {out_path}:")
    print(json.dumps(metrics, indent=2))


if __name__ == "__main__":
    main()
