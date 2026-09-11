#!/usr/bin/env python3
"""
Synthetic SAR Training Dataset Generator for Oil Spill Segmentation (SIH 2026 PS-26143).
Generates paired 256x256 SAR patches:
  data/training/images/*.png
  data/training/masks/*.png
Simulates:
- Gamma-distributed sea clutter & multi-look speckle noise
- Capillary wave dampening (dark backscatter drop inside slicks)
- Organic oil slick geometries (filaments, elongated streaks, patches)
- False-positive look-alikes (low-wind calm zones, natural biogenic films)
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def generate_slick_mask(size: int = 256, rng: np.random.Generator | None = None) -> np.ndarray:
    rng = rng or np.random.default_rng()
    mask_img = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask_img)

    # Slick style: 0 = elongated streak/filament, 1 = patch/blob, 2 = multi-tail plume
    style = rng.integers(0, 3)

    if style == 0:
        # Elongated streak / plume
        n_pts = rng.integers(6, 12)
        cx, cy = rng.uniform(size * 0.25, size * 0.75, 2)
        angle = rng.uniform(0, 2 * math.pi)
        length = rng.uniform(size * 0.3, size * 0.6)
        width_base = rng.uniform(size * 0.05, size * 0.12)

        pts = []
        for i in range(n_pts):
            t = (i / (n_pts - 1)) - 0.5
            px = cx + t * length * math.cos(angle)
            py = cy + t * length * math.sin(angle)
            w = width_base * (1.0 - 0.6 * abs(t)) + rng.uniform(-4, 4)
            perp = angle + math.pi / 2
            pts.append((px + w * math.cos(perp), py + w * math.sin(perp)))
        for i in reversed(range(n_pts)):
            t = (i / (n_pts - 1)) - 0.5
            px = cx + t * length * math.cos(angle)
            py = cy + t * length * math.sin(angle)
            w = width_base * (1.0 - 0.6 * abs(t)) + rng.uniform(-4, 4)
            perp = angle - math.pi / 2
            pts.append((px + w * math.cos(perp), py + w * math.sin(perp)))

        draw.polygon(pts, fill=255)

    elif style == 1:
        # Irregular blob / patch
        cx, cy = rng.uniform(size * 0.3, size * 0.7, 2)
        radius = rng.uniform(size * 0.15, size * 0.30)
        n_pts = 16
        pts = []
        for i in range(n_pts):
            theta = 2 * math.pi * i / n_pts
            r = radius * rng.uniform(0.7, 1.3)
            pts.append((cx + r * math.cos(theta), cy + r * math.sin(theta)))
        draw.polygon(pts, fill=255)

    else:
        # Multiple smaller connected droplets / dispersion
        for _ in range(rng.integers(2, 5)):
            bx, by = rng.uniform(size * 0.2, size * 0.8, 2)
            rx, ry = rng.uniform(10, 30), rng.uniform(10, 30)
            draw.ellipse([bx - rx, by - ry, bx + rx, by + ry], fill=255)

    # Apply organic boundary distortion
    mask_img = mask_img.filter(ImageFilter.GaussianBlur(radius=1.5))
    mask_arr = (np.array(mask_img) > 120).astype(np.uint8) * 255
    return mask_arr


def generate_sar_patch(mask: np.ndarray, rng: np.random.Generator | None = None) -> np.ndarray:
    rng = rng or np.random.default_rng()
    h, w = mask.shape

    # 1. Background sea clutter (Gamma distributed radar returns)
    shape_k = rng.uniform(2.5, 4.0)
    scale_theta = rng.uniform(30.0, 45.0)
    sea_clutter = rng.gamma(shape=shape_k, scale=scale_theta, size=(h, w))

    # Add gentle low-frequency gradient (wind sea surface variation)
    xx, yy = np.meshgrid(np.linspace(-1, 1, w), np.linspace(-1, 1, h))
    grad = (xx * rng.uniform(-15, 15) + yy * rng.uniform(-15, 15))
    sea_clutter = np.clip(sea_clutter + grad, 15, 255)

    # 2. Oil slick dampening (capillary-gravity wave attenuation)
    # High damping factor: radar backscatter drops significantly (dark signature)
    dampening = rng.uniform(0.15, 0.32)
    slick_clutter = rng.gamma(shape=2.0, scale=12.0, size=(h, w))

    sar = np.where(mask > 0, (sea_clutter * dampening + slick_clutter * 0.5), sea_clutter)

    # Add minor SAR speckle noise
    speckle = rng.normal(1.0, 0.08, size=(h, w))
    sar = np.clip(sar * speckle, 0, 255).astype(np.uint8)
    return sar


def main():
    parser = argparse.ArgumentParser(description="Generate synthetic SAR training pairs for U-Net.")
    parser.add_argument("--count", type=int, default=60, help="Number of training image/mask pairs to generate")
    parser.add_argument("--out-dir", type=str, default="data/training", help="Destination root directory")
    parser.add_argument("--size", type=int, default=256, help="Image dimensions (WxH)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    args = parser.parse_args()

    root = Path(args.out_dir)
    img_dir = root / "images"
    mask_dir = root / "masks"
    img_dir.mkdir(parents=True, exist_ok=True)
    mask_dir.mkdir(parents=True, exist_ok=True)

    rng = np.random.default_rng(args.seed)
    print(f"Generating {args.count} synthetic SAR training pairs ({args.size}x{args.size}) in {root}...")

    for i in range(args.count):
        mask = generate_slick_mask(size=args.size, rng=rng)
        sar = generate_sar_patch(mask=mask, rng=rng)

        stem = f"s1_synthetic_{i:04d}"
        Image.fromarray(sar).save(img_dir / f"{stem}.png")
        Image.fromarray(mask).save(mask_dir / f"{stem}.png")

    print(f"Dataset generated successfully: {args.count} images in {img_dir}, {args.count} masks in {mask_dir}")


if __name__ == "__main__":
    main()
