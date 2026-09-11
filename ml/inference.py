"""U-Net inference with an explicit prototype fallback when weights are missing."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np

from ml.preprocessing import load_sar_gray, normalize_sar, resize_square, speckle_reduce

WEIGHTS_PATH = Path(__file__).resolve().parent / "weights" / "unet_oilspill.pt"


class UNet(object):
    """Thin wrapper so train.py and inference share the same architecture name."""

    def __init__(self, in_channels: int = 1, out_channels: int = 1, base: int = 16):
        import torch
        import torch.nn as nn

        class DoubleConv(nn.Module):
            def __init__(self, cin, cout):
                super().__init__()
                self.net = nn.Sequential(
                    nn.Conv2d(cin, cout, 3, padding=1),
                    nn.BatchNorm2d(cout),
                    nn.ReLU(inplace=True),
                    nn.Conv2d(cout, cout, 3, padding=1),
                    nn.BatchNorm2d(cout),
                    nn.ReLU(inplace=True),
                )

            def forward(self, x):
                return self.net(x)

        class _UNet(nn.Module):
            def __init__(self):
                super().__init__()
                self.d1 = DoubleConv(in_channels, base)
                self.d2 = DoubleConv(base, base * 2)
                self.d3 = DoubleConv(base * 2, base * 4)
                self.d4 = DoubleConv(base * 4, base * 8)
                self.pool = nn.MaxPool2d(2)
                self.u3 = nn.ConvTranspose2d(base * 8, base * 4, 2, stride=2)
                self.c3 = DoubleConv(base * 8, base * 4)
                self.u2 = nn.ConvTranspose2d(base * 4, base * 2, 2, stride=2)
                self.c2 = DoubleConv(base * 4, base * 2)
                self.u1 = nn.ConvTranspose2d(base * 2, base, 2, stride=2)
                self.c1 = DoubleConv(base * 2, base)
                self.out = nn.Conv2d(base, out_channels, 1)

            def forward(self, x):
                x1 = self.d1(x)
                x2 = self.d2(self.pool(x1))
                x3 = self.d3(self.pool(x2))
                x4 = self.d4(self.pool(x3))
                y = self.u3(x4)
                y = self.c3(torch.cat([y, x3], dim=1))
                y = self.u2(y)
                y = self.c2(torch.cat([y, x2], dim=1))
                y = self.u1(y)
                y = self.c1(torch.cat([y, x1], dim=1))
                return torch.sigmoid(self.out(y))

        self.module = _UNet()


def weights_available(path: Path | None = None) -> bool:
    p = path or WEIGHTS_PATH
    return p.exists() and p.stat().st_size > 0


def prototype_detect(sar_norm: np.ndarray) -> np.ndarray:
    """Dark elongated region detector used only when trained weights are absent."""
    import cv2

    inv = 1.0 - sar_norm
    blur = cv2.GaussianBlur(inv, (9, 9), 0)
    thresh = float(np.percentile(blur, 88))
    binary = (blur >= thresh).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    num, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
    if num <= 1:
        return binary.astype(np.float32)
    areas = stats[1:, cv2.CC_STAT_AREA]
    keep = 1 + int(np.argmax(areas))
    mask = (labels == keep).astype(np.float32)
    # Soft probability from local darkness inside the kept component
    prob = blur * mask
    if prob.max() > 0:
        prob = prob / prob.max()
    return np.clip(prob, 0.0, 1.0)


def run_inference(image_path: str, threshold: float = 0.45) -> dict[str, Any]:
    sar = load_sar_gray(image_path)
    original_hw = sar.shape
    sar_n = speckle_reduce(normalize_sar(sar))

    mode = "prototype_demo"
    label = "Prototype / Demo"
    if weights_available():
        try:
            import torch

            from backend.models.unet import UNet as CanonicalUNet

            model = CanonicalUNet()
            state = torch.load(WEIGHTS_PATH, map_location="cpu")
            model.load_state_dict(state)
            model.eval()
            resized = resize_square(sar_n, 256)
            tensor = torch.from_numpy(resized[None, None, ...])
            with torch.no_grad():
                pred = model(tensor).numpy()[0, 0]
            import cv2

            probability = cv2.resize(pred, (original_hw[1], original_hw[0]), interpolation=cv2.INTER_LINEAR)
            mode = "ml_model"
            label = "U-Net ML Inference"
        except Exception:
            probability = prototype_detect(sar_n)
            mode = "prototype_demo"
            label = "Prototype / Demo"
    else:
        probability = prototype_detect(sar_n)

    binary = (probability >= threshold).astype(np.uint8)
    confidence = float(probability[binary == 1].mean()) if binary.any() else 0.0
    return {
        "probability": probability,
        "binary_mask": binary,
        "confidence": round(confidence, 4),
        "threshold": threshold,
        "mode": mode,
        "mode_label": label,
        "weights_path": str(WEIGHTS_PATH) if weights_available() else None,
        "image_shape": list(original_hw),
        "disclaimer": (
            "Trained U-Net weights were used for segmentation."
            if mode == "ml_model"
            else "Prototype Detection — trained model weights unavailable. "
            "This is a deterministic demo detector, not a trained deep-learning prediction."
        ),
    }
