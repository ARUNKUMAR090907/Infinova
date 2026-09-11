"""Generate synthetic SAR, AIS, and mask assets for the SIH prototype."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]


def generate_sar(path: Path, size: int = 512) -> None:
    rng = np.random.default_rng(42)
    speckle = rng.lognormal(mean=0.0, sigma=0.35, size=(size, size))
    sea = 0.55 + 0.12 * speckle
    sea = np.clip(sea / sea.max(), 0, 1)

    yy, xx = np.mgrid[0:size, 0:size]
    # Elongated dark slick, rotated, with tapered ends
    cx, cy = 270, 250
    ang = np.deg2rad(-28)
    xr = (xx - cx) * np.cos(ang) + (yy - cy) * np.sin(ang)
    yr = -(xx - cx) * np.sin(ang) + (yy - cy) * np.cos(ang)
    slick = np.exp(-((xr / 95) ** 2) - (yr / 18) ** 2)
    sea = sea * (1.0 - 0.72 * slick)

    land = xx < 18
    sea[land] = 0.18

    img = (sea * 255).astype(np.uint8)
    Image.fromarray(img, mode="L").save(path)

    mask = (slick > 0.28).astype(np.uint8) * 255
    Image.fromarray(mask, mode="L").save(path.with_name("demo_sar_mask.png"))


def generate_overlay_preview(sar_path: Path) -> None:
    sar = Image.open(sar_path).convert("RGB")
    mask = Image.open(sar_path.with_name("demo_sar_mask.png"))
    overlay = Image.new("RGBA", sar.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    arr = np.array(mask)
    ys, xs = np.where(arr > 0)
    for y, x in zip(ys[::8], xs[::8]):
        draw.point((int(x), int(y)), fill=(220, 70, 40, 120))
    out = Image.alpha_composite(sar.convert("RGBA"), overlay)
    out.convert("RGB").save(sar_path.with_name("demo_sar_preview.png"))


if __name__ == "__main__":
    sat = ROOT / "data" / "satellite"
    sat.mkdir(parents=True, exist_ok=True)
    generate_sar(sat / "demo_sar.png")
    generate_overlay_preview(sat / "demo_sar.png")
    print("Wrote synthetic SAR assets to", sat)
