"""
MIXMIND - Vocal & Instrumental Characteristic Estimator
Estimates vocal presence vs instrumental drive using Harmonic-Percussive Source Separation
and vocal formant bandwidth energy ratios.
"""

from typing import Dict, Any, Tuple
import numpy as np
import librosa


def estimate_vocal_and_instrumental(y: np.ndarray, sr: int = 22050) -> Dict[str, float]:
    """
    Estimates vocal presence ratio and instrumental confidence.
    1. Uses HPSS (Harmonic-Percussive Source Separation) to separate sustained melodic components.
    2. Measures spectral energy concentration in the human vocal formant band (300 Hz - 3400 Hz).
    3. Evaluates spectral flatness (vocals exhibit structured formant peaks vs flat noise/cymbals).
    """
    if len(y) < sr * 2:
        return {"vocal_presence": 0.5, "instrumental_confidence": 0.5}

    try:
        # 1. Harmonic-percussive separation
        y_harm, y_perc = librosa.effects.hpss(y)

        harm_energy = np.mean(y_harm ** 2)
        perc_energy = np.mean(y_perc ** 2)
        total_energy = harm_energy + perc_energy + 1e-9

        # Harmonic vs percussive ratio
        harmonic_ratio = harm_energy / total_energy

        # 2. STFT of harmonic component
        n_fft = 2048
        hop_length = 512
        S = np.abs(librosa.stft(y_harm, n_fft=n_fft, hop_length=hop_length))
        freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)

        # 3. Energy in human vocal band (300 - 3400 Hz)
        vocal_mask = (freqs >= 300) & (freqs <= 3400)
        vocal_energy = np.sum(S[vocal_mask, :] ** 2)
        full_spectrum_energy = np.sum(S ** 2) + 1e-9

        vocal_band_ratio = float(vocal_energy / full_spectrum_energy)

        # 4. Spectral Flatness (vocals have low flatness due to prominent harmonic peaks)
        flatness = float(np.mean(librosa.feature.spectral_flatness(y=y_harm)))

        # Composite Vocal Presence Score:
        # Heavily gated by actual energy presence in the human vocal frequency band (300 - 3400 Hz).
        # Sub-bass, basslines, and cymbals outside this band cannot produce vocal presence.
        formant_structure = (0.65 * harmonic_ratio) + (0.35 * (1.0 - min(1.0, flatness * 10.0)))
        raw_vocal = vocal_band_ratio * formant_structure * 2.2

        vocal_presence = float(np.clip(raw_vocal, 0.02, 0.98))
        instrumental_confidence = float(np.clip(1.0 - vocal_presence, 0.02, 0.98))

        return {
            "vocal_presence": round(vocal_presence, 2),
            "instrumental_confidence": round(instrumental_confidence, 2)
        }

    except Exception:
        return {"vocal_presence": 0.5, "instrumental_confidence": 0.5}
