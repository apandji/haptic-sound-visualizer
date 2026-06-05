"""
Shared EEG channel quality metrics and classification for Ganglion streaming.

Classification uses RMS (μV) in the 1–45 Hz band only — no 60 Hz term.
Thresholds: data/eeg_quality_config.json (keep in sync with js/modules/eegQualityConfig.js).
"""

import json
import os
from typing import Any, Dict, List, Optional

import numpy as np

try:
    from brainflow.data_filter import DataFilter
    try:
        from brainflow.data_filter import WindowFunctions
        WINDOW = WindowFunctions.HANNING.value
    except ImportError:
        WINDOW = 1
    BRAINFLOW_FILTERS = True
except ImportError:
    BRAINFLOW_FILTERS = False
    WINDOW = 1

_CONFIG_PATH = os.path.join(os.path.dirname(__file__), "data", "eeg_quality_config.json")
_DEFAULT_CONFIG: Dict[str, Any] = {
    "rms_good_min": 5.0,
    "rms_good_max": 100.0,
    "rms_ok_max": 150.0,
    "eeg_band_hz": [1.0, 45.0],
    "quality_labels": {"good": "GOOD", "ok": "OK", "poor": "POOR"},
    "stability_seconds": 1.5,
    "stability_min_good_channels": 3,
    "window_fill_seconds": 2.0,
}


def load_quality_config() -> Dict[str, Any]:
    try:
        with open(_CONFIG_PATH, "r", encoding="utf-8") as handle:
            data = json.load(handle)
            if isinstance(data, dict):
                merged = dict(_DEFAULT_CONFIG)
                merged.update(data)
                return merged
    except (OSError, json.JSONDecodeError):
        pass
    return dict(_DEFAULT_CONFIG)


QUALITY_CONFIG = load_quality_config()


def classify_rms_tier(rms_uV: float, config: Optional[Dict[str, Any]] = None) -> str:
    """Original RMS-only tiers: good 5–100, ok 100–150, else poor."""
    cfg = config or QUALITY_CONFIG
    rms = float(rms_uV)
    if not np.isfinite(rms):
        return "poor"
    if cfg["rms_good_min"] <= rms <= cfg["rms_good_max"]:
        return "good"
    if rms > cfg["rms_good_max"] and rms <= cfg["rms_ok_max"]:
        return "ok"
    return "poor"


def classify_channel_quality(rms_uV: float, _p60_rel: float = 0.0, config: Optional[Dict[str, Any]] = None) -> str:
    """Classify a channel from RMS only (p60 ignored for API compatibility)."""
    return classify_rms_tier(rms_uV, config)


def quality_display_label(quality: str, config: Optional[Dict[str, Any]] = None) -> str:
    cfg = config or QUALITY_CONFIG
    labels = cfg.get("quality_labels") or {}
    return labels.get(quality, quality)


def _band_power(psd: np.ndarray, freqs: np.ndarray, f0: float, f1: float) -> float:
    idx = np.logical_and(freqs >= f0, freqs <= f1)
    if not np.any(idx):
        return 0.0
    val = float(np.trapz(psd[idx], freqs[idx]))
    if not np.isfinite(val):
        return 0.0
    return val


def compute_single_channel_metrics(sig_uV: np.ndarray, fs: int, config: Optional[Dict[str, Any]] = None) -> Dict[str, float]:
    cfg = config or QUALITY_CONFIG
    eeg_f0, eeg_f1 = cfg["eeg_band_hz"]

    if not BRAINFLOW_FILTERS or sig_uV is None or len(sig_uV) < 16:
        return {"rms_uV": 0.0, "quality": "poor"}

    data_len = len(sig_uV)
    nfft = DataFilter.get_nearest_power_of_two(data_len)
    if nfft >= data_len:
        nfft = nfft // 2
    nfft = max(8, nfft)
    overlap = nfft // 2

    psd, freqs = DataFilter.get_psd_welch(sig_uV, nfft, overlap, fs, WINDOW)
    psd = np.asarray(psd)
    freqs = np.asarray(freqs)

    total_1_45 = _band_power(psd, freqs, eeg_f0, eeg_f1)
    if total_1_45 <= 0 or not np.isfinite(total_1_45):
        total_1_45 = 1e-12

    rms_uV = float(np.sqrt(total_1_45))
    quality = classify_rms_tier(rms_uV, cfg)

    return {"rms_uV": rms_uV, "quality": quality}


def compute_channel_metrics(
    raw_eeg_uV: np.ndarray,
    fs: int,
    board_channel_indices=None,
    config: Optional[Dict[str, Any]] = None,
) -> List[Dict[str, Any]]:
    metrics: List[Dict[str, Any]] = []
    if raw_eeg_uV is None or raw_eeg_uV.ndim < 2 or raw_eeg_uV.shape[1] < 16:
        return metrics

    n_ch = raw_eeg_uV.shape[0]
    for ci in range(n_ch):
        channel_values = compute_single_channel_metrics(raw_eeg_uV[ci, :], fs, config)
        metric = {
            "channel_index": ci,
            "rms_uV": channel_values["rms_uV"],
            "quality": channel_values["quality"],
        }
        if board_channel_indices is not None and ci < len(board_channel_indices):
            metric["board_channel_index"] = int(board_channel_indices[ci])
        metrics.append(metric)

    return metrics


def quality_to_score(quality: str) -> int:
    if quality == "good":
        return 100
    if quality == "ok":
        return 70
    return 30


def channel_quality_hint(rms_uV: float, quality: str, config: Optional[Dict[str, Any]] = None) -> str:
    cfg = config or QUALITY_CONFIG
    rms = float(rms_uV)

    if quality == "good":
        return "Contact looks good."

    if not np.isfinite(rms) or rms < cfg["rms_good_min"]:
        return "Re-gel or re-seat electrode — very low signal."
    if rms > cfg["rms_ok_max"]:
        return "Check movement or muscle tension — signal saturated."
    if rms > cfg["rms_good_max"]:
        return "Signal high — ask participant to sit still and relax jaw."
    return "Adjust electrode contact."
