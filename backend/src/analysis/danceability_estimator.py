"""
MIXMIND - Danceability & Rhythm Regularity Estimator
Estimates danceability from beat pulse clarity, rhythmic regularity, and low-frequency drive.
"""

from typing import Tuple, Dict, Any
import numpy as np


def estimate_danceability(onset_env: np.ndarray, bpm: float, sr: int = 22050, hop_length: int = 512) -> float:
    """
    Computes a composite danceability index [0.0 to 1.0].
    Combines:
    1. Pulse clarity: Prominence of autocorrelation peak of the onset envelope.
    2. Tempo suitability: Optimum dance floor range is 120-130 BPM.
    3. Beat regularity: Uniformity of transient energy.
    """
    if len(onset_env) < 100:
        return 0.5

    # 1. Autocorrelation of onset envelope
    # Window to search for tempo lags (between 60 BPM and 180 BPM)
    fps = sr / float(hop_length)
    min_lag = int(fps * 60.0 / 180.0)  # ~180 BPM
    max_lag = int(fps * 60.0 / 60.0)   # ~60 BPM

    corr = np.correlate(onset_env, onset_env, mode="full")
    mid = len(corr) // 2
    lags_segment = corr[mid + min_lag : mid + max_lag]

    if len(lags_segment) == 0:
        pulse_clarity = 0.5
    else:
        peak_val = np.max(lags_segment)
        mean_val = np.mean(lags_segment)
        pulse_clarity = float((peak_val - mean_val) / (peak_val + 1e-6))
        pulse_clarity = max(0.0, min(1.0, pulse_clarity * 1.5))

    # 2. Tempo Suitability Curve (Gaussian centered at 124 BPM)
    # Peak danceability around 120-128 BPM
    tempo_score = float(np.exp(-((bpm - 124.0) ** 2) / (2 * (16.0 ** 2))))

    # 3. Dynamic Variation (avoiding flat, static noise or overly erratic music)
    onset_std = float(np.std(onset_env))
    onset_mean = float(np.mean(onset_env))
    coeff_var = (onset_std / (onset_mean + 1e-6)) if onset_mean > 0 else 0.5
    regularity_score = float(np.clip(coeff_var / 1.2, 0.2, 1.0))

    # Weighted composite
    danceability = (0.50 * pulse_clarity) + (0.35 * tempo_score) + (0.15 * regularity_score)
    return round(float(np.clip(danceability, 0.05, 0.98)), 2)
