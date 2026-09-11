"""Minimal U-Net training loop for SAR oil-slick masks.

Example:
    python -m ml.train --data-dir data/training --epochs 5 --out ml/weights/unet_oilspill.pt

Expects paired files:
    data/training/images/*.png
    data/training/masks/*.png

If no training dataset is present, this script exits without inventing accuracy figures.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image


def _load_pair(image_path: Path, mask_path: Path, size: int = 256):
    import cv2

    img = np.array(Image.open(image_path).convert("L"), dtype=np.float32) / 255.0
    mask = np.array(Image.open(mask_path).convert("L"), dtype=np.float32) / 255.0
    img = cv2.resize(img, (size, size))
    mask = cv2.resize(mask, (size, size), interpolation=cv2.INTER_NEAREST)
    return img, (mask > 0.5).astype(np.float32)


def _metrics(pred, target, eps: float = 1e-6):
    pb = (pred > 0.5).float()
    tb = (target > 0.5).float()
    inter = (pb * tb).sum()
    union = pb.sum() + tb.sum() - inter
    iou = float((inter + eps) / (union + eps))
    dice = float((2 * inter + eps) / (pb.sum() + tb.sum() + eps))
    tp = inter
    fp = (pb * (1 - tb)).sum()
    fn = ((1 - pb) * tb).sum()
    precision = float((tp + eps) / (tp + fp + eps))
    recall = float((tp + eps) / (tp + fn + eps))
    return iou, dice, precision, recall


def bootstrap_demo_pairs(data_dir: Path, n: int = 12) -> None:
    """Build a small synthetic training set from the bundled demo SAR + mask."""
    from data.generate_demo_assets import generate_sar

    root = Path(__file__).resolve().parents[1]
    sat = root / "data" / "satellite"
    sat.mkdir(parents=True, exist_ok=True)
    sar_path = sat / "demo_sar.png"
    mask_path = sat / "demo_sar_mask.png"
    if not sar_path.exists() or not mask_path.exists():
        generate_sar(sar_path)

    img = np.array(Image.open(sar_path).convert("L"))
    mask = np.array(Image.open(mask_path).convert("L"))
    images_dir = data_dir / "images"
    masks_dir = data_dir / "masks"
    images_dir.mkdir(parents=True, exist_ok=True)
    masks_dir.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(26143)
    for i in range(n):
        im = img.copy()
        mk = mask.copy()
        if i % 2 == 1:
            im = np.fliplr(im)
            mk = np.fliplr(mk)
        if i % 3 == 2:
            im = np.flipud(im)
            mk = np.flipud(mk)
        noise = rng.normal(0, 6, im.shape).astype(np.float32)
        im = np.clip(im.astype(np.float32) + noise, 0, 255).astype(np.uint8)
        Image.fromarray(im, mode="L").save(images_dir / f"demo_{i:02d}.png")
        Image.fromarray(mk, mode="L").save(masks_dir / f"demo_{i:02d}.png")
    print(f"Wrote {n} synthetic image/mask pairs under {data_dir} (demo SAR augmentations, not a real labelled SAR archive).")


def main():
    parser = argparse.ArgumentParser(description="Train a small U-Net for oil-slick masks.")
    parser.add_argument("--data-dir", default="data/training")
    parser.add_argument("--epochs", type=int, default=5)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--val-frac", type=float, default=0.2)
    parser.add_argument("--out", default="ml/weights/unet_oilspill.pt")
    parser.add_argument(
        "--bootstrap-demo",
        action="store_true",
        help="Create a small synthetic training set from the demo SAR scene if no pairs exist.",
    )
    args = parser.parse_args()

    import torch
    from torch.utils.data import DataLoader, Dataset, random_split

    from backend.models.unet import UNet, dice_loss

    images_dir = Path(args.data_dir) / "images"
    masks_dir = Path(args.data_dir) / "masks"
    pairs = []
    for p in sorted(images_dir.glob("*")):
        m = masks_dir / p.name
        if m.exists():
            pairs.append((p, m))
    if not pairs and args.bootstrap_demo:
        bootstrap_demo_pairs(Path(args.data_dir))
        for p in sorted(images_dir.glob("*")):
            m = masks_dir / p.name
            if m.exists():
                pairs.append((p, m))
    if not pairs:
        raise SystemExit(
            f"No image/mask pairs found under {images_dir} and {masks_dir}. "
            "Add paired PNG files before training. Do not invent accuracy numbers."
        )

    class PairDataset(Dataset):
        def __len__(self):
            return len(pairs)

        def __getitem__(self, idx):
            img, mask = _load_pair(*pairs[idx])
            x = torch.from_numpy(img[None, ...])
            y = torch.from_numpy(mask[None, ...])
            return x, y

    dataset = PairDataset()
    n_val = max(1, int(len(dataset) * args.val_frac)) if len(dataset) > 1 else 0
    n_train = len(dataset) - n_val
    if n_val:
        train_ds, val_ds = random_split(dataset, [n_train, n_val])
    else:
        train_ds, val_ds = dataset, None
    loader = DataLoader(train_ds, batch_size=2, shuffle=True)
    val_loader = DataLoader(val_ds, batch_size=2) if val_ds is not None else None

    model = UNet()
    opt = torch.optim.Adam(model.parameters(), lr=args.lr)
    bce = torch.nn.BCELoss()
    best_dice = -1.0
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)

    for epoch in range(args.epochs):
        model.train()
        losses = []
        for x, y in loader:
            opt.zero_grad()
            pred = model(x)
            loss = bce(pred, y) + dice_loss(pred, y)
            loss.backward()
            opt.step()
            losses.append(float(loss.item()))

        msg = f"epoch {epoch + 1}/{args.epochs} train_loss={np.mean(losses):.4f}"
        if val_loader:
            model.eval()
            ious, dices, precs, recs = [], [], [], []
            with torch.no_grad():
                for x, y in val_loader:
                    pred = model(x)
                    iou, dice, precision, recall = _metrics(pred, y)
                    ious.append(iou)
                    dices.append(dice)
                    precs.append(precision)
                    recs.append(recall)
            mean_dice = float(np.mean(dices))
            msg += (
                f" val_iou={np.mean(ious):.4f} val_dice={mean_dice:.4f} "
                f"val_p={np.mean(precs):.4f} val_r={np.mean(recs):.4f}"
            )
            if mean_dice > best_dice:
                best_dice = mean_dice
                torch.save(model.state_dict(), out)
                msg += " [saved best]"
        print(msg)

    if val_loader is None:
        torch.save(model.state_dict(), out)
        print(f"Saved weights to {out} (no validation split; last epoch)")
    else:
        print(f"Best validation Dice={best_dice:.4f} saved to {out}")


if __name__ == "__main__":
    main()
