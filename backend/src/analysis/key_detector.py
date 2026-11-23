"""
MIXMIND - Musical Key & Mode Estimation Engine
Implements Krumhansl-Schmuckler and Temperley key profile correlation.
Distinguishes key tonic, mode (major/minor), Camelot code, and confidence.
"""

from typing import Tuple, Dict, Any
import numpy as np

from ..intelligence.camelot import normalize_to_camelot

# Pitch class labels
PITCH_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Krumhansl-Kessler Key Profiles
KK_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KK_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])

# Temperley Key Profiles (enhanced for modern electronic and popular music)
TEMP_MAJOR = np.array([5.0, 2.0, 3.5, 2.0, 4.5, 4.0, 2.0, 4.5, 2.0, 3.5, 1.5, 4.0])
TEMP_MINOR = np.array([5.0, 2.0, 3.5, 4.5, 2.0, 4.0, 2.0, 4.5, 3.5, 2.0, 1.5, 4.0])


def estimate_key_and_mode(chroma: np.ndarray) -> Dict[str, Any]:
    """
    Correlates an energy-averaged chroma vector (12 pitch classes)
    against major and minor tonal profiles.
    Returns:
      - key: Tonic pitch class (e.g. 'C', 'A')
      - mode: 'major' or 'minor'
      - camelot_key: Normalized Camelot wheel string (e.g. '8A', '8B')
      - confidence: Correlation coefficient normalized to [0.0, 1.0]
      - top_candidates: List of top 3 candidate keys with scores
    """
    if chroma.ndim > 1:
        chroma_vector = np.mean(chroma, axis=1)
    else:
        chroma_vector = chroma.copy()

    norm = np.linalg.norm(chroma_vector)
    if norm > 0:
        chroma_vector = chroma_vector / norm

    candidates = []

    for i in range(12):
        tonic = PITCH_NAMES[i]

        # Shift templates
        kk_maj_rot = np.roll(KK_MAJOR, i)
        kk_min_rot = np.roll(KK_MINOR, i)
        t_maj_rot = np.roll(TEMP_MAJOR, i)
        t_min_rot = np.roll(TEMP_MINOR, i)

        # Pearson correlation
        corr_kk_maj = float(np.corrcoef(chroma_vector, kk_maj_rot)[0, 1])
        corr_kk_min = float(np.corrcoef(chroma_vector, kk_min_rot)[0, 1])
        corr_t_maj = float(np.corrcoef(chroma_vector, t_maj_rot)[0, 1])
        corr_t_min = float(np.corrcoef(chroma_vector, t_min_rot)[0, 1])

        # Blended score (60% Temperley, 40% Krumhansl-Kessler)
        score_maj = (0.6 * corr_t_maj) + (0.4 * corr_kk_maj)
        score_min = (0.6 * corr_t_min) + (0.4 * corr_kk_min)

        candidates.append({
            "key": tonic,
            "mode": "major",
            "full_name": tonic,
            "camelot_key": normalize_to_camelot(tonic),
            "score": score_maj if not np.isnan(score_maj) else 0.0
        })

        candidates.append({
            "key": tonic,
            "mode": "minor",
            "full_name": f"{tonic}m",
            "camelot_key": normalize_to_camelot(f"{tonic}m"),
            "score": score_min if not np.isnan(score_min) else 0.0
        })

    candidates.sort(key=lambda x: x["score"], reverse=True)
    best = candidates[0]

    # Normalize Pearson correlation [-1, 1] to confidence [0.0, 1.0]
    raw_score = best["score"]
    confidence = max(0.0, min(1.0, (raw_score + 0.2) / 1.2))

    return {
        "key": best["key"],
        "mode": best["mode"],
        "full_name": best["full_name"],
        "camelot_key": best["camelot_key"],
        "confidence": round(confidence, 3),
        "top_candidates": [
            {
                "name": c["full_name"],
                "camelot": c["camelot_key"],
                "score": round(c["score"], 3)
            }
            for c in candidates[:3]
        ]
    }
