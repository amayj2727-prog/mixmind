"""
MIXMIND - Master Audio Analysis & Music Intelligence Engine
Extracts deterministic acoustic measurements and estimated musical labels.
Strictly local, multi-threaded, with persistent disk and database caching.
"""

import os
import json
import time
import logging
from typing import Dict, Any, Optional

import numpy as np
import soundfile as sf
import librosa

from .models import (
    MeasuredAcousticFeatures,
    EstimatedMusicalFeatures,
    AudioAnalysisReport,
    StructuralSection,
)
from .key_detector import estimate_key_and_mode
from .danceability_estimator import estimate_danceability
from .vocal_detector import estimate_vocal_and_instrumental
from .structure_detector import detect_structural_sections

logger = logging.getLogger("AudioAnalysisEngine")

DEFAULT_CACHE_DIR = os.path.expanduser("~/Desktop/MIXMIND/data/cache/analysis")


class AudioAnalyzer:
    def __init__(self, cache_dir: str = DEFAULT_CACHE_DIR):
        self.cache_dir = cache_dir
        os.makedirs(self.cache_dir, exist_ok=True)

    def analyze_file(
        self,
        filepath: str,
        file_hash: str = "",
        force_reanalysis: bool = False,
        user_overrides: Optional[Dict[str, Any]] = None
    ) -> AudioAnalysisReport:
        """
        Runs comprehensive acoustic measurements and musical inferences.
        Checks cache first to avoid re-analyzing unchanged files.
        """
        start_time = time.time()
        abs_path = os.path.abspath(filepath)

        if not os.path.exists(abs_path):
            raise FileNotFoundError(f"Audio file not found: {abs_path}")

        # 1. Check JSON Cache
        if not force_reanalysis and file_hash:
            cached_report = self._load_from_cache(file_hash)
            if cached_report:
                if user_overrides:
                    cached_report.user_overrides.update(user_overrides)
                return cached_report

        logger.info(f"Analyzing audio file: {os.path.basename(abs_path)}")

        # 2. Load Audio Signal
        # Use 22.05 kHz mono for rapid, highly accurate feature extraction
        sr = 22050
        y, file_info = self._load_audio(abs_path, target_sr=sr)
        duration = file_info["duration"]

        if len(y) == 0:
            raise ValueError(f"Empty audio signal from: {abs_path}")

        # 3. Direct Acoustic Measurements
        measured = self._compute_measured_features(y, sr, file_info)

        # 4. Beat Grid & BPM Estimation
        bpm, bpm_conf, onset_env = self._estimate_tempo_and_onsets(y, sr)

        # 5. Key & Mode Estimation (Chroma CQT)
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        key_res = estimate_key_and_mode(chroma)

        # 6. Danceability Estimation
        danceability = estimate_danceability(onset_env, bpm, sr=sr)

        # 7. Vocal & Instrumental Characteristics
        vocal_res = estimate_vocal_and_instrumental(y, sr)

        # 8. Composite Musical Energy (Not just simple RMS!)
        # Combines RMS loudness, sub-bass drive, brightness (centroid), and transient punchiness
        energy_rating = self._compute_composite_energy(measured, onset_env)

        estimated = EstimatedMusicalFeatures(
            bpm=bpm,
            bpm_confidence=bpm_conf,
            key=key_res["key"],
            mode=key_res["mode"],
            camelot_key=key_res["camelot_key"],
            key_confidence=key_res["confidence"],
            energy_rating=energy_rating,
            danceability=danceability,
            vocal_presence=vocal_res["vocal_presence"],
            instrumental_confidence=vocal_res["instrumental_confidence"]
        )

        # 9. Structural Sections (Intro, Outro, Drops, Breakdowns)
        intro_cue, outro_cue, drops, breakdowns, sections = detect_structural_sections(
            y=y, sr=sr, duration=duration, bpm=bpm
        )

        processing_time = round(time.time() - start_time, 3)

        report = AudioAnalysisReport(
            filepath=abs_path,
            file_hash=file_hash,
            analyzed_at=time.time(),
            processing_time_seconds=processing_time,
            measured=measured,
            estimated=estimated,
            sections=sections,
            intro_cue=intro_cue,
            outro_cue=outro_cue,
            drops=drops,
            breakdowns=breakdowns,
            user_overrides=user_overrides or {}
        )

        # 10. Save to Cache
        if file_hash:
            self._save_to_cache(file_hash, report)

        logger.info(
            f"Analysis complete for {os.path.basename(abs_path)} in {processing_time}s: "
            f"BPM={estimated.bpm} ({estimated.bpm_confidence:.2f}), Key={estimated.key}{'m' if estimated.mode == 'minor' else ''} [{estimated.camelot_key}], "
            f"Energy={estimated.energy_rating:.2f}, Danceability={estimated.danceability:.2f}"
        )
        return report

    def _load_audio(self, filepath: str, target_sr: int = 22050):
        """Loads audio signal and inspects technical stream metadata."""
        info = {
            "duration": 0.0,
            "sample_rate": 44100,
            "channels": 2,
            "bitrate": 0
        }

        # Try SoundFile first (ultra-fast for WAV/FLAC/AIFF)
        try:
            sf_info = sf.info(filepath)
            info["duration"] = round(float(sf_info.duration), 2)
            info["sample_rate"] = int(sf_info.samplerate)
            info["channels"] = int(sf_info.channels)
        except Exception:
            pass

        # Load with librosa
        y, sr = librosa.load(filepath, sr=target_sr, mono=True)
        if info["duration"] == 0.0:
            info["duration"] = round(float(len(y) / sr), 2)

        return y, info

    def _compute_measured_features(self, y: np.ndarray, sr: int, info: Dict[str, Any]) -> MeasuredAcousticFeatures:
        # RMS Energy
        hop_length = 512
        rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
        rms_mean = float(np.mean(rms))
        rms_peak = float(np.max(rms))

        # Dynamic range (dB)
        min_rms = float(np.percentile(rms[rms > 0], 5)) if np.any(rms > 0) else 1e-6
        dyn_range = 20 * np.log10((rms_peak + 1e-6) / (min_rms + 1e-6))

        # Spectral Centroid (Brightness)
        centroid = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop_length)[0]
        centroid_mean = float(np.mean(centroid))

        # Spectral Bandwidth (Frequency spread)
        bandwidth = librosa.feature.spectral_bandwidth(y=y, sr=sr, hop_length=hop_length)[0]
        bandwidth_mean = float(np.mean(bandwidth))

        # Spectral Rolloff (85% energy frequency)
        rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr, hop_length=hop_length)[0]
        rolloff_mean = float(np.mean(rolloff))

        # Zero Crossing Rate (Percussive / noisiness)
        zcr = librosa.feature.zero_crossing_rate(y=y, hop_length=hop_length)[0]
        zcr_mean = float(np.mean(zcr))

        # Spectral Flux (Rate of spectral change)
        onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)
        flux_mean = float(np.mean(onset_env))

        # Sub-band Energy Ratios (Low / Mid / High)
        n_fft = 2048
        S = np.abs(librosa.stft(y, n_fft=n_fft, hop_length=hop_length))
        freqs = librosa.fft_frequencies(sr=sr, n_fft=n_fft)

        low_mask = (freqs >= 20) & (freqs <= 250)
        mid_mask = (freqs > 250) & (freqs <= 4000)
        high_mask = (freqs > 4000)

        total_pwr = np.sum(S ** 2) + 1e-9
        low_pwr = np.sum(S[low_mask, :] ** 2) / total_pwr
        mid_pwr = np.sum(S[mid_mask, :] ** 2) / total_pwr
        high_pwr = np.sum(S[high_mask, :] ** 2) / total_pwr

        return MeasuredAcousticFeatures(
            duration_seconds=info["duration"],
            sample_rate=info["sample_rate"],
            channels=info["channels"],
            rms_energy_mean=round(rms_mean, 4),
            rms_energy_peak=round(rms_peak, 4),
            rms_dynamic_range_db=round(float(dyn_range), 1),
            spectral_centroid_mean=round(centroid_mean, 1),
            spectral_bandwidth_mean=round(bandwidth_mean, 1),
            spectral_rolloff_mean=round(rolloff_mean, 1),
            spectral_flux_mean=round(flux_mean, 3),
            zero_crossing_rate_mean=round(zcr_mean, 4),
            low_band_energy_ratio=round(float(low_pwr), 3),
            mid_band_energy_ratio=round(float(mid_pwr), 3),
            high_band_energy_ratio=round(float(high_pwr), 3),
        )

    def _estimate_tempo_and_onsets(self, y: np.ndarray, sr: int):
        hop_length = 512
        onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop_length)

        # Beat tracking with tempo estimation
        tempo, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr, hop_length=hop_length)
        bpm = float(tempo[0] if hasattr(tempo, "__len__") else tempo)
        bpm = round(bpm, 1)

        # Confidence: evaluate autocorrelation peak prominence
        corr = librosa.autocorrelate(onset_env, max_size=int(sr / hop_length * 4))
        peak_ratio = 0.5
        if len(corr) > 10:
            peak_ratio = float((np.max(corr[10:]) - np.mean(corr[10:])) / (np.max(corr[10:]) + 1e-6))
        confidence = float(np.clip(peak_ratio * 1.5, 0.4, 0.98))

        return bpm, round(confidence, 2), onset_env

    def _compute_composite_energy(self, m: MeasuredAcousticFeatures, onset_env: np.ndarray) -> float:
        """
        Computes a comprehensive musical energy score [0.0 - 1.0].
        Does NOT rely solely on simple RMS!
        Combines:
        1. 35% RMS amplitude (loudness normalized to 0.20 reference)
        2. 25% Low-frequency bass drive (kick/sub energy ratio)
        3. 25% Spectral centroid / brightness (scaled to 4000 Hz)
        4. 15% Transient punchiness (mean onset flux)
        """
        rms_score = min(1.0, m.rms_energy_mean / 0.18)
        bass_score = min(1.0, m.low_band_energy_ratio / 0.45)
        bright_score = min(1.0, m.spectral_centroid_mean / 3500.0)
        punch_score = min(1.0, m.spectral_flux_mean / 2.5)

        composite = (0.35 * rms_score) + (0.25 * bass_score) + (0.25 * bright_score) + (0.15 * punch_score)
        return round(float(np.clip(composite, 0.05, 0.98)), 2)

    def _get_cache_path(self, file_hash: str) -> str:
        return os.path.join(self.cache_dir, f"{file_hash}.json")

    def _load_from_cache(self, file_hash: str) -> Optional[AudioAnalysisReport]:
        cache_file = self._get_cache_path(file_hash)
        if os.path.isfile(cache_file):
            try:
                with open(cache_file, "r") as f:
                    data = json.load(f)
                return AudioAnalysisReport.from_dict(data)
            except Exception as e:
                logger.debug(f"Cache read error for {file_hash}: {e}")
        return None

    def _save_to_cache(self, file_hash: str, report: AudioAnalysisReport):
        cache_file = self._get_cache_path(file_hash)
        try:
            with open(cache_file, "w") as f:
                json.dump(report.to_dict(), f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to write analysis cache for {file_hash}: {e}")
