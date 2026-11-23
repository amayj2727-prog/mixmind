"""
MIXMIND - Structural Section & Cue Point Detector
Identifies Intro, Outro, Breakdown, and Drop sections across multi-band energy curves.
"""

from typing import List, Dict, Any, Tuple
import numpy as np
import librosa

from .models import StructuralSection


def detect_structural_sections(
    y: np.ndarray,
    sr: int = 22050,
    duration: float = 0.0,
    bpm: float = 124.0
) -> Tuple[float, float, List[float], List[Dict[str, float]], List[StructuralSection]]:
    """
    Analyzes temporal energy envelopes across frequency sub-bands:
    - Low-band (20 - 250 Hz): Kicks & sub-bass
    - Mid-band (250 - 4000 Hz): Vocals, synths, chords
    - High-band (4000 - 20000 Hz): Hi-hats, cymbals, air

    Returns:
      - intro_cue: float (seconds)
      - outro_cue: float (seconds)
      - drops: List[float] (timestamps in seconds)
      - breakdowns: List[Dict[str, float]] ({start, end, duration})
      - sections: List[StructuralSection]
    """
    if duration <= 10.0 or len(y) < sr * 10:
        return 0.0, max(0.0, duration - 10.0), [], [], []

    # 1. Multi-band filtering / STFT energy curves
    hop_length = int(sr * 0.5)  # 500ms time windows
    n_fft = 2048
    S = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop_length))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)

    # Low band (20 - 250 Hz)
    low_mask = (freqs >= 20) & (freqs <= 250)
    low_energy = np.mean(S[low_mask, :] ** 2, axis=0)
    # Mid/high band
    mid_mask = (freqs > 250) & (freqs <= 4000)
    mid_energy = np.mean(S[mid_mask, :] ** 2, axis=0)
    # Total RMS
    total_rms = np.sqrt(np.mean(S ** 2, axis=0))

    # Normalize envelopes [0.0 - 1.0]
    low_norm = low_energy / (np.max(low_energy) + 1e-9)
    mid_norm = mid_energy / (np.max(mid_energy) + 1e-9)
    total_norm = total_rms / (np.max(total_rms) + 1e-9)

    num_frames = len(total_norm)
    frame_duration = 0.5  # seconds per frame
    times = np.arange(num_frames) * frame_duration

    sections: List[StructuralSection] = []
    breakdowns: List[Dict[str, float]] = []
    drops: List[float] = []

    # 2. Intro Candidate Detection
    # Search first 25% of song: find first frame where total energy exceeds noise threshold
    first_sound_frame = 0
    for idx, val in enumerate(total_norm[: int(num_frames * 0.25)]):
        if val > 0.08:
            first_sound_frame = idx
            break
    intro_start = round(float(times[first_sound_frame]), 2)

    # Intro end / Main groove start: where low bass energy jumps above 0.35
    intro_end = round(min(duration * 0.35, 30.0), 2)
    for idx in range(first_sound_frame, min(num_frames, int(num_frames * 0.35))):
        if low_norm[idx] > 0.35:
            intro_end = round(float(times[idx]), 2)
            break

    intro_cue = intro_start
    sections.append(StructuralSection(
        section_type="intro",
        start_time=intro_start,
        end_time=intro_end,
        confidence=0.85,
        energy_level=round(float(np.mean(total_norm[first_sound_frame:int(intro_end / frame_duration) + 1])), 2)
    ))

    # 3. Outro Candidate Detection
    # Last 20-30% of track: where low bass drops out or overall energy fades
    outro_start = round(max(0.0, duration - 32.0), 2)
    tail_frames = int(num_frames * 0.70)
    for idx in range(num_frames - 1, tail_frames, -1):
        if low_norm[idx] > 0.30:
            outro_start = round(float(times[idx]), 2)
            break

    outro_cue = outro_start
    sections.append(StructuralSection(
        section_type="outro",
        start_time=outro_start,
        end_time=round(duration, 2),
        confidence=0.80,
        energy_level=round(float(np.mean(total_norm[int(outro_start / frame_duration):])), 2)
    ))

    # 4. Breakdown & Drop Detection
    # Breakdown: segment in the middle where low_norm drops below 0.15 while mid_norm > 0.25
    in_breakdown = False
    bd_start_time = 0.0

    # Search between intro and outro
    mid_start_idx = int(intro_end / frame_duration)
    mid_end_idx = int(outro_start / frame_duration)

    for idx in range(mid_start_idx, mid_end_idx):
        is_bd = (low_norm[idx] < 0.18) and (mid_norm[idx] > 0.20)

        if is_bd and not in_breakdown:
            in_breakdown = True
            bd_start_time = times[idx]

        elif not is_bd and in_breakdown:
            in_breakdown = False
            bd_end_time = times[idx]
            bd_dur = bd_end_time - bd_start_time

            # Valid breakdown is at least 4 seconds (approx 2 bars)
            if bd_dur >= 4.0:
                breakdowns.append({
                    "start": round(float(bd_start_time), 2),
                    "end": round(float(bd_end_time), 2),
                    "duration": round(float(bd_dur), 2)
                })
                sections.append(StructuralSection(
                    section_type="breakdown",
                    start_time=round(float(bd_start_time), 2),
                    end_time=round(float(bd_end_time), 2),
                    confidence=0.75,
                    energy_level=round(float(np.mean(total_norm[int(bd_start_time / frame_duration):idx])), 2)
                ))

                # Drop: The downbeat moment immediately after breakdown where bass explodes
                if idx < num_frames - 2 and low_norm[idx] > 0.45:
                    drop_time = round(float(bd_end_time), 2)
                    drops.append(drop_time)
                    sections.append(StructuralSection(
                        section_type="drop",
                        start_time=drop_time,
                        end_time=min(round(duration, 2), round(drop_time + 15.0, 2)),
                        confidence=0.88,
                        energy_level=round(float(np.max(total_norm[idx:idx + 4])), 2)
                    ))

    # If no explicit breakdown was detected, find the global maximum energy surge as primary drop
    if not drops and mid_end_idx > mid_start_idx:
        max_idx = mid_start_idx + int(np.argmax(low_norm[mid_start_idx:mid_end_idx]))
        drops.append(round(float(times[max_idx]), 2))

    return intro_cue, outro_cue, drops, breakdowns, sections
