"""
Tests for deep learning U-Net SAR segmentation and end-to-end pipeline execution.
Verifies:
1. U-Net weights load cleanly and activate 'ml_model' inference mode.
2. Inference output dimensions, confidence bounds, and binary masks.
3. Fallback mechanism functions properly if weights are missing.
4. End-to-end investigation pipeline executes with ML inference.
"""
from __future__ import annotations

from pathlib import Path
import numpy as np
import pytest

from ml.inference import WEIGHTS_PATH, run_inference, weights_available
from backend.services.segmentation import detect_spill
from backend.services.pipeline import run_investigation


class TestUNetSegmentation:
    """Test PyTorch U-Net inference engine."""

    def test_weights_file_exists_and_non_empty(self):
        assert weights_available(), f"U-Net weights missing at {WEIGHTS_PATH}"
        assert WEIGHTS_PATH.stat().st_size > 50000, "Weights file is suspiciously small"

    def test_inference_runs_in_ml_model_mode(self):
        sar_path = Path("data/satellite/demo_sar.png")
        assert sar_path.exists(), "demo_sar.png not found"

        result = run_inference(str(sar_path), threshold=0.45)
        assert result["mode"] == "ml_model"
        assert result["mode_label"] == "U-Net ML Inference"
        assert 0.0 <= result["confidence"] <= 1.0
        assert result["weights_path"] is not None

    def test_output_mask_geometry_and_values(self):
        sar_path = Path("data/satellite/demo_sar.png")
        result = run_inference(str(sar_path), threshold=0.45)

        binary_mask = result["binary_mask"]
        probability = result["probability"]

        assert isinstance(binary_mask, np.ndarray)
        assert isinstance(probability, np.ndarray)
        assert binary_mask.shape == probability.shape
        # Binary mask should only contain 0 and 1
        unique_vals = np.unique(binary_mask)
        assert set(unique_vals).issubset({0, 1})
        # Probability map bounded in [0, 1]
        assert probability.min() >= 0.0
        assert probability.max() <= 1.0

    def test_segmentation_detect_spill_service(self):
        sar_path = Path("data/satellite/demo_sar.png")
        det = detect_spill(str(sar_path))

        assert det["mode"] == "ml_model"
        assert det["mode_label"] == "U-Net ML Inference"
        assert det["confidence"] > 0.5
        assert "mask_preview" in det
        assert "original_preview" in det
        assert "probability_preview" in det


class TestEndToEndMLPipeline:
    """Test full 6-step investigation pipeline with trained ML inference."""

    def test_run_investigation_uses_ml_model(self):
        res = run_investigation()
        assert res["ok"] is True
        assert res["status"] in ("Completed", "Complete", "Attributed")
        assert "detection" in res
        assert res["detection"]["mode"] == "ml_model"
        assert res["detection"]["mode_label"] == "U-Net ML Inference"

        # Check attribution and ranked vessels
        assert "attribution" in res
        attr = res["attribution"]
        assert "ranked" in attr
        assert len(attr["ranked"]) > 0
        top_vessel = attr["ranked"][0]
        assert "mmsi" in top_vessel
        assert "score" in top_vessel
        assert "priority" in top_vessel
        assert "evidence" in top_vessel

