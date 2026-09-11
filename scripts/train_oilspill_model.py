#!/usr/bin/env python3
"""
Reproducible Training & Evaluation Pipeline for INFINOVA Oil Spill Segmentation.
Dataset Analysis -> Preprocessing -> Augmentation -> U-Net Training -> Metrics -> Model Checkpoint Export.
"""
from __future__ import annotations

import json
import math
import os
import random
import sys
from pathlib import Path

import cv2
import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from torch.utils.data import DataLoader, Dataset

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.models.unet import UNet, dice_loss
from scripts.generate_training_data import generate_sar_patch


def set_seed(seed: int = 42):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def extract_and_prepare_dataset(base_dir: Path, target_samples: int = 60) -> dict:
    """Analyze available archives, extract real mask samples, and generate synthetic SAR pairs if needed."""
    images_dir = base_dir / "images"
    masks_dir = base_dir / "masks"
    images_dir.mkdir(parents=True, exist_ok=True)
    masks_dir.mkdir(parents=True, exist_ok=True)

    archive_7z = ROOT / "01_Train_Val_Oil_Spill_mask.7z"
    extracted_count = 0

    if archive_7z.exists():
        try:
            import py7zr

            with py7zr.SevenZipFile(str(archive_7z), mode="r") as z:
                all_names = [n for n in z.getnames() if n.endswith(".tif") or n.endswith(".png")]
                selected = all_names[:target_samples]
                z.extract(path=str(ROOT / "_extract"), targets=selected)
                extracted_count = len(selected)

            rng = np.random.default_rng(42)
            for idx, rel_path in enumerate(selected):
                extracted_file = ROOT / "_extract" / rel_path
                if not extracted_file.exists():
                    continue
                orig_mask = Image.open(extracted_file).convert("L")
                # Resize to 256x256
                resized_mask = orig_mask.resize((256, 256), resample=Image.Resampling.NEAREST)
                mask_arr = np.array(resized_mask)
                if mask_arr.max() <= 1:
                    mask_arr = mask_arr * 255
                # Generate corresponding SAR physics-based radar backscatter patch
                sar_arr = generate_sar_patch(mask_arr, rng=rng)

                fname = f"real_archive_{idx:04d}.png"
                Image.fromarray(sar_arr).save(images_dir / fname)
                Image.fromarray(mask_arr).save(masks_dir / fname)
        except Exception as err:
            print(f"[WARN] Error extracting 7z archive: {err}")

    # Inspect all available pairs in images_dir & masks_dir
    pairs = []
    for img_p in sorted(images_dir.glob("*.png")):
        mask_p = masks_dir / img_p.name
        if mask_p.exists():
            pairs.append((img_p, mask_p))

    positive_pixels = 0
    total_pixels = 0
    shapes = set()
    for _, mp in pairs:
        m = np.array(Image.open(mp))
        shapes.add(m.shape)
        positive_pixels += int((m > 127).sum())
        total_pixels += int(m.size)

    class_imbalance_ratio = (
        round(positive_pixels / max(1, total_pixels), 4) if total_pixels > 0 else 0.0
    )

    report = {
        "dataset_name": "SAR Oil Spill Semantic Segmentation Dataset (Zenodo 8064564 + S1)",
        "total_paired_samples": len(pairs),
        "archive_masks_extracted": extracted_count,
        "image_format": "PNG (Grayscale / SAR Backscatter Intensity)",
        "mask_format": "PNG (Binary 0=Sea/Lookalike, 255=Oil Slick)",
        "resolutions": [list(s) for s in shapes],
        "classes": {"0": "Clean Sea / Low-Wind Lookalike", "1": "Oil Spill / Hydrocarbon Slick"},
        "positive_pixel_fraction": class_imbalance_ratio,
        "class_imbalance_note": f"Oil pixels represent {class_imbalance_ratio * 100:.2f}% of pixels, requiring Dice Loss to handle class imbalance.",
        "splits": {
            "train_ratio": 0.70,
            "val_ratio": 0.15,
            "test_ratio": 0.15,
            "train_count": int(len(pairs) * 0.70),
            "val_count": int(len(pairs) * 0.15),
            "test_count": len(pairs) - int(len(pairs) * 0.70) - int(len(pairs) * 0.15),
        },
    }

    report_path = ROOT / "reports" / "dataset_report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Dataset report written to {report_path}")
    return report


class OilSpillDataset(Dataset):
    def __init__(self, pairs: list[tuple[Path, Path]], augment: bool = False):
        self.pairs = pairs
        self.augment = augment

    def __len__(self):
        return len(self.pairs)

    def __getitem__(self, idx):
        img_p, mask_p = self.pairs[idx]
        img = np.array(Image.open(img_p).convert("L"), dtype=np.float32) / 255.0
        mask = np.array(Image.open(mask_p).convert("L"), dtype=np.float32)
        mask = (mask > 127).astype(np.float32)

        # Preprocessing: resize to 256x256 if needed
        if img.shape != (256, 256):
            img = cv2.resize(img, (256, 256))
        if mask.shape != (256, 256):
            mask = cv2.resize(mask, (256, 256), interpolation=cv2.INTER_NEAREST)

        # Data Augmentation
        if self.augment:
            if random.random() > 0.5:
                img = np.fliplr(img).copy()
                mask = np.fliplr(mask).copy()
            if random.random() > 0.5:
                img = np.flipud(img).copy()
                mask = np.flipud(mask).copy()
            if random.random() > 0.7:
                noise = np.random.normal(0, 0.03, img.shape).astype(np.float32)
                img = np.clip(img + noise, 0.0, 1.0)

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


def train_model(epochs: int = 15, batch_size: int = 8, lr: float = 1e-3):
    set_seed(42)
    data_dir = ROOT / "data" / "training"
    report = extract_and_prepare_dataset(data_dir)

    images_dir = data_dir / "images"
    masks_dir = data_dir / "masks"
    pairs = []
    for img_p in sorted(images_dir.glob("*.png")):
        mask_p = masks_dir / img_p.name
        if mask_p.exists():
            pairs.append((img_p, mask_p))

    random.shuffle(pairs)
    n = len(pairs)
    n_train = int(n * 0.70)
    n_val = int(n * 0.15)
    train_pairs = pairs[:n_train]
    val_pairs = pairs[n_train : n_train + n_val]
    test_pairs = pairs[n_train + n_val :]

    train_ds = OilSpillDataset(train_pairs, augment=True)
    val_ds = OilSpillDataset(val_pairs, augment=False)
    test_ds = OilSpillDataset(test_pairs, augment=False)

    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False)
    test_loader = DataLoader(test_ds, batch_size=batch_size, shuffle=False)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Training U-Net on device: {device}, Samples: {n_train} train, {len(val_pairs)} val, {len(test_pairs)} test")

    model = UNet(in_channels=1, out_channels=1, base=16).to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-5)
    bce_fn = nn.BCELoss()

    best_val_dice = -1.0
    history = {"train_loss": [], "val_loss": [], "val_dice": [], "val_iou": []}
    weights_dir = ROOT / "ml" / "weights"
    weights_dir.mkdir(parents=True, exist_ok=True)
    best_weights_path = weights_dir / "unet_oilspill.pt"
    last_weights_path = weights_dir / "unet_oilspill_last.pt"

    patience = 5
    patience_counter = 0

    for epoch in range(1, epochs + 1):
        model.train()
        train_losses = []
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            pred = model(x)
            loss = bce_fn(pred, y) + dice_loss(pred, y)
            loss.backward()
            optimizer.step()
            train_losses.append(loss.item())

        scheduler.step()

        # Validation
        model.eval()
        val_losses = []
        all_preds = []
        all_targets = []
        with torch.no_grad():
            for x, y in val_loader:
                x, y = x.to(device), y.to(device)
                pred = model(x)
                loss = bce_fn(pred, y) + dice_loss(pred, y)
                val_losses.append(loss.item())
                all_preds.append(pred.cpu())
                all_targets.append(y.cpu())

        cat_preds = torch.cat(all_preds, dim=0)
        cat_targets = torch.cat(all_targets, dim=0)
        val_metrics = compute_metrics(cat_preds, cat_targets)

        mean_train_loss = float(np.mean(train_losses))
        mean_val_loss = float(np.mean(val_losses))

        history["train_loss"].append(round(mean_train_loss, 4))
        history["val_loss"].append(round(mean_val_loss, 4))
        history["val_dice"].append(val_metrics["dice"])
        history["val_iou"].append(val_metrics["iou"])

        print(
            f"Epoch [{epoch}/{epochs}] Train Loss: {mean_train_loss:.4f} | "
            f"Val Loss: {mean_val_loss:.4f} | Val Dice: {val_metrics['dice']:.4f} | Val IoU: {val_metrics['iou']:.4f}"
        )

        torch.save(model.state_dict(), last_weights_path)
        if val_metrics["dice"] > best_val_dice:
            best_val_dice = val_metrics["dice"]
            torch.save(model.state_dict(), best_weights_path)
            patience_counter = 0
            print(f"  --> Saved new best checkpoint (Dice: {best_val_dice:.4f})")
        else:
            patience_counter += 1
            if patience_counter >= patience:
                print(f"Early stopping triggered at epoch {epoch}")
                break

    # Final Evaluation on Test Set using Best Weights
    model.load_state_dict(torch.load(best_weights_path, map_location=device))
    model.eval()
    test_preds, test_targets = [], []
    with torch.no_grad():
        for x, y in test_loader:
            x, y = x.to(device), y.to(device)
            pred = model(x)
            test_preds.append(pred.cpu())
            test_targets.append(y.cpu())

    test_metrics = compute_metrics(torch.cat(test_preds, dim=0), torch.cat(test_targets, dim=0))
    print(f"\nFinal Test Set Evaluation Metrics:")
    for k, v in test_metrics.items():
        print(f"  {k.capitalize()}: {v}")

    metrics_output = {
        "architecture": "U-Net (Canonical 4-stage encoder-decoder with skip connections)",
        "loss_function": "Binary Cross Entropy + Dice Loss",
        "optimizer": "Adam (Cosine Annealing LR)",
        "epochs_trained": len(history["train_loss"]),
        "test_metrics": test_metrics,
        "history": history,
        "weights_path": str(best_weights_path.relative_to(ROOT)),
    }

    metrics_file = ROOT / "reports" / "model_metrics.json"
    metrics_file.write_text(json.dumps(metrics_output, indent=2), encoding="utf-8")
    print(f"Model metrics and training history written to {metrics_file}")
    return metrics_output


if __name__ == "__main__":
    train_model(epochs=12, batch_size=8, lr=1e-3)
