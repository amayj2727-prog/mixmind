"""
MIXMIND - Database Data Models
"""

import os
from dataclasses import dataclass, asdict, field
from typing import Optional, Dict, Any, List


@dataclass
class Track:
    filepath: str
    filename: str
    file_hash: str
    title: str
    artist: str
    file_size: int = 0
    file_mtime: float = 0.0
    file_format: str = ""
    album: str = "Unknown Album"
    genre: str = "Unknown Genre"
    year: Optional[int] = None
    duration: float = 0.0
    bpm: float = 124.0
    initial_key: str = "8A"
    camelot_key: str = "8A"
    energy: float = 0.5
    danceability: float = 0.5
    vocal_presence: float = 0.5
    loudness: float = 0.0
    sample_rate: int = 44100
    bitrate: int = 0
    channels: int = 2
    cue_in: float = 0.0
    cue_out: float = 0.0
    phrase_length: int = 32
    is_duplicate: int = 0
    duplicate_of_id: Optional[int] = None
    scan_status: str = "scanned"
    scan_error: str = ""
    user_bpm_override: Optional[float] = None
    user_key_override: Optional[str] = None
    user_cue_in_override: Optional[float] = None
    user_cue_out_override: Optional[float] = None
    play_count: int = 0
    last_played_at: float = 0.0
    id: Optional[int] = None

    @property
    def effective_bpm(self) -> float:
        """Returns user-corrected BPM if provided, else algorithmic estimate."""
        if self.user_bpm_override is not None and self.user_bpm_override > 0:
            return float(self.user_bpm_override)
        return float(self.bpm)

    @property
    def effective_key(self) -> str:
        """Returns user-corrected musical key if provided, else algorithmic estimate."""
        if self.user_key_override:
            from ..intelligence.camelot import normalize_to_camelot
            return normalize_to_camelot(self.user_key_override)
        return self.camelot_key

    @property
    def effective_cue_in(self) -> float:
        if self.user_cue_in_override is not None:
            return float(self.user_cue_in_override)
        return float(self.cue_in)

    @property
    def effective_cue_out(self) -> float:
        if self.user_cue_out_override is not None:
            return float(self.user_cue_out_override)
        return float(self.cue_out)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["effective_bpm"] = self.effective_bpm
        d["effective_key"] = self.effective_key
        d["effective_cue_in"] = self.effective_cue_in
        d["effective_cue_out"] = self.effective_cue_out
        return d

    @classmethod
    def from_row(cls, row: Dict[str, Any]) -> "Track":
        return cls(
            id=row.get("id"),
            filepath=row["filepath"],
            filename=row.get("filename") or os.path.basename(row["filepath"]),
            file_hash=row.get("file_hash", ""),
            file_size=int(row.get("file_size", 0)),
            file_mtime=float(row.get("file_mtime", 0.0)),
            file_format=row.get("file_format", ""),
            title=row.get("title", ""),
            artist=row.get("artist", ""),
            album=row.get("album", "Unknown Album"),
            genre=row.get("genre", "Unknown Genre"),
            year=row.get("year"),
            duration=float(row.get("duration", 0.0)),
            bpm=float(row.get("bpm", 124.0)),
            initial_key=row.get("initial_key", "8A"),
            camelot_key=row.get("camelot_key", "8A"),
            energy=float(row.get("energy", 0.5)),
            danceability=float(row.get("danceability", 0.5)),
            vocal_presence=float(row.get("vocal_presence", 0.5)),
            loudness=float(row.get("loudness", 0.0)),
            sample_rate=int(row.get("sample_rate", 44100)),
            bitrate=int(row.get("bitrate", 0)),
            channels=int(row.get("channels", 2)),
            cue_in=float(row.get("cue_in", 0.0)),
            cue_out=float(row.get("cue_out", 0.0)),
            phrase_length=int(row.get("phrase_length", 32)),
            is_duplicate=int(row.get("is_duplicate", 0)),
            duplicate_of_id=row.get("duplicate_of_id"),
            scan_status=row.get("scan_status", "scanned"),
            scan_error=row.get("scan_error", ""),
            user_bpm_override=float(row["user_bpm_override"]) if row.get("user_bpm_override") else None,
            user_key_override=row.get("user_key_override"),
            user_cue_in_override=float(row["user_cue_in_override"]) if row.get("user_cue_in_override") else None,
            user_cue_out_override=float(row["user_cue_out_override"]) if row.get("user_cue_out_override") else None,
            play_count=int(row.get("play_count", 0)),
            last_played_at=float(row.get("last_played_at", 0.0)),
        )


@dataclass
class ScanResult:
    folder_path: str
    total_files_found: int = 0
    supported_files: int = 0
    unsupported_ignored: int = 0
    added: int = 0
    updated: int = 0
    skipped_unchanged: int = 0
    duplicates_detected: int = 0
    errors_count: int = 0
    errors: List[Dict[str, str]] = field(default_factory=list)
    duration_seconds: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class CuePoint:
    track_id: int
    name: str
    time_seconds: float
    cue_type: str = "cue"
    id: Optional[int] = None


@dataclass
class MixRecord:
    session_id: str
    from_track_id: Optional[int]
    to_track_id: Optional[int]
    transition_type: str
    phrase_beats: int = 32
    rating: int = 0
    timestamp: float = 0.0
    notes: str = ""
    id: Optional[int] = None
