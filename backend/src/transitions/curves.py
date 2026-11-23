"""
MIXMIND - Transition Mathematical Curves
Computes smooth curves for crossfader, EQ low/mid/high, and high-pass filter sweeps.
"""

import math


def linear_curve(progress: float, start_val: float, end_val: float) -> float:
    p = max(0.0, min(1.0, float(progress)))
    return start_val + (end_val - start_val) * p


def exponential_curve(progress: float, start_val: float, end_val: float, exponent: float = 2.0) -> float:
    p = max(0.0, min(1.0, float(progress)))
    return start_val + (end_val - start_val) * (p ** exponent)


def s_curve(progress: float, start_val: float, end_val: float) -> float:
    """Smooth S-curve (sigmoid) transition for gentle melodic and progressive blends."""
    p = max(0.0, min(1.0, float(progress)))
    # Smoothstep interpolation: 3p^2 - 2p^3
    smooth_p = p * p * (3.0 - 2.0 * p)
    return start_val + (end_val - start_val) * smooth_p


def logarithmic_curve(progress: float, start_val: float, end_val: float) -> float:
    """Quick initial rise followed by gentle tapering."""
    p = max(0.0, min(1.0, float(progress)))
    log_p = math.log10(1.0 + 9.0 * p)
    return start_val + (end_val - start_val) * log_p


def filter_sweep_curve(progress: float, start_filter: float = 0.5, max_filter: float = 0.75) -> float:
    """Sweeps High-Pass Filter up during buildup to thin low frequencies and build tension."""
    p = max(0.0, min(1.0, float(progress)))
    return start_filter + (max_filter - start_filter) * (p ** 1.5)
