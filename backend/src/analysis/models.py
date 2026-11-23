"""
MIXMIND - Audio Analysis Data Models
Distinguishes directly measured acoustic features from estimated musical labels.
"""

from dataclasses import dataclass, asdict, field
from typing import List, Dict, Any, Optional


@dataclass
class MeasuredAcousticFeatures:
    """Deterministic, directly measured signal properties."""
    duration_seconds: float = 0.0
    sample_rate: int = 44100
    channels: int = 2
    rms_energy_mean: float = 0.0
    rms_energy_peak: float = 0.0
    rms_dynamic_range_db: float = 0.0
    spectral_centroid_mean: float = 0.0     # Hz (center of mass / brightness)
    spectral_bandwidth_mean: float = 0.0    # Hz (frequency spread)
    spectral_rolloff_mean: float = 0.0      # Hz (85% energy threshold)
    spectral_flux_mean: float = 0.0         # Rate of spectral change
    zero_crossing_rate_mean: float = 0.0    # Percussive/noisiness index
    low_band_energy_ratio: float = 0.0      # Sub/Bass energy (20 - 250 Hz)
    mid_band_energy_ratio: float = 0.0      # Mid/Vocal energy (250 - 4000 Hz)
    high_band_energy_ratio: float = 0.0     # High/Air energy (4000 - 20000 Hz)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class EstimatedMusicalFeatures:
    """Heuristic and machine-learning inferred musical attributes."""
    bpm: float = 124.0
    bpm_confidence: float = 0.5            # 0.0 to 1.0 (pulse peak prominence)
    key: str = "A"                         # Tonic pitch class (C, C#, D, etc.)
    mode: str = "minor"                    # "major" or "minor"
    camelot_key: str = "8A"                # Camelot wheel code (8A, 8B, etc.)
    key_confidence: float = 0.5            # Correlation against key profile (0.0 to 1.0)
    energy_rating: float = 0.5             # Multi-faceted energy index (0.0 to 1.0)
    danceability: float = 0.5              # Rhythmic regularity index (0.0 to 1.0)
    vocal_presence: float = 0.5            # Estimated vocal content ratio (0.0 to 1.0)
    instrumental_confidence: float = 0.5   # Estimated instrumental confidence (0.0 to 1.0)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class StructuralSection:
    """A detected musical segment (intro, drop, breakdown, outro, groove)."""
    section_type: str                      # "intro", "drop", "breakdown", "buildup", "outro", "groove"
    start_time: float                      # Seconds
    end_time: float                        # Seconds
    confidence: float = 0.5                # 0.0 to 1.0
    energy_level: float = 0.5              # 0.0 to 1.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class AudioAnalysisReport:
    """Comprehensive structured analysis report consumed by MIXMIND AI DJ Engine."""
    filepath: str
    file_hash: str
    analyzed_at: float
    processing_time_seconds: float
    measured: MeasuredAcousticFeatures
    estimated: EstimatedMusicalFeatures
    sections: List[StructuralSection] = field(default_factory=list)
    intro_cue: float = 0.0
    outro_cue: float = 0.0
    drops: List[float] = field(default_factory=list)
    breakdowns: List[Dict[str, float]] = field(default_factory=list)
    user_overrides: Dict[str, Any] = field(default_factory=dict)

    def get_effective_bpm(self) -> float:
        """Returns user-overridden BPM if set, else estimated BPM."""
        return float(self.user_overrides.get("bpm") or self.estimated.bpm)

    def get_effective_key(self) -> str:
        """Returns user-overridden key if set, else estimated key."""
        return str(self.user_overrides.get("key") or f"{self.estimated.key}{'m' if self.estimated.mode == 'minor' else ''}")

    def get_effective_camelot(self) -> str:
        return str(self.user_overrides.get("camelot_key") or self.estimated.camelot_key)

    def get_effective_cue_in(self) -> float:
        return float(self.user_overrides.get("cue_in") if "cue_in" in self.user_overrides else self.intro_cue)

    def get_effective_cue_out(self) -> float:
        return float(self.user_overrides.get("cue_out") if "cue_out" in self.user_overrides else self.outro_cue)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "filepath": self.filepath,
            "file_hash": self.file_hash,
            "analyzed_at": self.analyzed_at,
            "processing_time_seconds": self.processing_time_seconds,
            "measured": self.measured.to_dict(),
            "estimated": self.estimated.to_dict(),
            "sections": [s.to_dict() for s in self.sections],
            "intro_cue": self.intro_cue,
            "outro_cue": self.outro_cue,
            "drops": self.drops,
            "breakdowns": self.breakdowns,
            "user_overrides": self.user_overrides,
            "effective": {
                "bpm": self.get_effective_bpm(),
                "key": self.get_effective_key(),
                "camelot_key": self.get_effective_camelot(),
                "cue_in": self.get_effective_cue_in(),
                "cue_out": self.get_effective_cue_out(),
            }
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "AudioAnalysisReport":
        measured = MeasuredAcousticFeatures(**d.get("measured", {}))
        estimated = EstimatedMusicalFeatures(**d.get("estimated", {}))
        sections = [StructuralSection(**s) for s in d.get("sections", [])]
        return cls(
            filepath=d["filepath"],
            file_hash=d.get("file_hash", ""),
            analyzed_at=float(d.get("analyzed_at", 0.0)),
            processing_time_seconds=float(d.get("processing_time_seconds", 0.0)),
            measured=measured,
            estimated=estimated,
            sections=sections,
            intro_cue=float(d.get("intro_cue", 0.0)),
            outro_cue=float(d.get("outro_cue", 0.0)),
            drops=d.get("drops", []),
            breakdowns=d.get("breakdowns", []),
            user_overrides=d.get("user_overrides", {})
        )
