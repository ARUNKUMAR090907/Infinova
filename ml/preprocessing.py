"""SAR preprocessing for oil-slick segmentation."""

from __future__ import annotations

import numpy as np
from PIL import Image


def load_sar_gray(path: str) -> np.ndarray:
    image = Image.open(path).convert("L")
    return np.array(image, dtype=np.float32)


def normalize_sar(array: np.ndarray) -> np.ndarray:
    arr = array.astype(np.float32)
    vmin, vmax = np.percentile(arr, 1), np.percentile(arr, 99)
    if vmax <= vmin:
        vmax = vmin + 1.0
    return np.clip((arr - vmin) / (vmax - vmin), 0.0, 1.0)


def speckle_reduce(array: np.ndarray, ksize: int = 5) -> np.ndarray:
    """Simple box-filter speckle reduction (prototype, not a full SAR despeckle)."""
    import cv2

    kernel = np.ones((ksize, ksize), np.float32) / (ksize * ksize)
    return cv2.filter2D(array.astype(np.float32), -1, kernel)


def resize_square(array: np.ndarray, size: int = 256) -> np.ndarray:
    import cv2

    return cv2.resize(array, (size, size), interpolation=cv2.INTER_AREA)


def preprocess_sar(gray: np.ndarray, size: int = 256) -> np.ndarray:
    import cv2

    arr = gray.astype(np.float32)
    arr = cv2.GaussianBlur(arr, (5, 5), 0)
    p2, p98 = np.percentile(arr, (2, 98))
    arr = np.clip((arr - p2) / (p98 - p2 + 1e-6), 0, 1) * 255.0
    return arr


def to_tensor_nchw(gray: np.ndarray, size: int = 256):
    import cv2

    prep = preprocess_sar(gray, size)
    resized = cv2.resize(prep, (size, size), interpolation=cv2.INTER_AREA)
    tensor = (resized / 255.0).astype(np.float32)[None, None, ...]
    return tensor, resized
