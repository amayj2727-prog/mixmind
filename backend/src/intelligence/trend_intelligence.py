"""
MIXMIND - Trend Intelligence System
Provides the AI DJ with market awareness of contemporary musical trends:
- Trending genres, popular BPM ranges, emerging tracks, remix styles, and festival combinations.

Strict Architectural Principles:
1. Trend data is kept completely isolated from the local user music library (never pollutes tracks DB).
2. Never assumes a trending track exists in the user's library.
3. Matches external trend intelligence against locally owned music files.
4. Records source provenance and freshness lifecycle (fresh, aging, stale).
5. Zero downloading of copyrighted audio files.
6. Zero scraping against website terms; powered by manually importable snapshots and verified feeds.
"""

import os
import json
import csv
import time
import uuid
import logging
from dataclasses import dataclass, asdict, field
from typing import Dict, Any, List, Optional, Tuple

from ..database.models import Track

logger = logging.getLogger("TrendIntelligence")

DEFAULT_TRENDS_DIR = os.path.expanduser("~/Desktop/MIXMIND/data/trends")


@dataclass
class TrendingGenre:
    genre: str
    popularity_rank: int
    typical_bpm_range: Tuple[float, float]
    energy_profile: float                     # Expected energy (0.0 to 1.0)
    key_characteristics: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class TrendingTrack:
    title: str
    artist: str
    genre: str
    remix_artist: Optional[str] = None
    bpm: Optional[float] = None
    key: Optional[str] = None
    trend_rank: int = 1
    movement: str = "steady"                  # "rising", "peak", "steady", "falling"
    source: str = "Manual Import"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class TrendingRemixStyle:
    style_name: str
    description: str
    target_bpm_range: Tuple[float, float]
    compatible_genres: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class TrendSnapshot:
    snapshot_id: str
    source_name: str
    source_type: str                          # "manual_import", "curated_snapshot", "community_list"
    timestamp: float                          # Epoch seconds
    freshness_days: int = 30
    trending_genres: List[TrendingGenre] = field(default_factory=list)
    trending_tracks: List[TrendingTrack] = field(default_factory=list)
    trending_remix_styles: List[TrendingRemixStyle] = field(default_factory=list)
    popular_bpm_ranges: Dict[str, List[float]] = field(default_factory=dict)
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "snapshot_id": self.snapshot_id,
            "source_name": self.source_name,
            "source_type": self.source_type,
            "timestamp": self.timestamp,
            "freshness_days": self.freshness_days,
            "trending_genres": [g.to_dict() for g in self.trending_genres],
            "trending_tracks": [t.to_dict() for t in self.trending_tracks],
            "trending_remix_styles": [r.to_dict() for r in self.trending_remix_styles],
            "popular_bpm_ranges": self.popular_bpm_ranges,
            "notes": self.notes
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TrendSnapshot":
        genres = [
            TrendingGenre(**g) if isinstance(g, dict) else g
            for g in data.get("trending_genres", [])
        ]
        tracks = [
            TrendingTrack(**t) if isinstance(t, dict) else t
            for t in data.get("trending_tracks", [])
        ]
        styles = [
            TrendingRemixStyle(**s) if isinstance(s, dict) else s
            for s in data.get("trending_remix_styles", [])
        ]
        return cls(
            snapshot_id=data.get("snapshot_id", str(uuid.uuid4())[:8]),
            source_name=data.get("source_name", "Unknown Source"),
            source_type=data.get("source_type", "manual_import"),
            timestamp=float(data.get("timestamp", time.time())),
            freshness_days=int(data.get("freshness_days", 30)),
            trending_genres=genres,
            trending_tracks=tracks,
            trending_remix_styles=styles,
            popular_bpm_ranges=data.get("popular_bpm_ranges", {}),
            notes=data.get("notes", "")
        )


@dataclass
class TrendMatchResult:
    local_track: Track
    matched_trending_track: Optional[TrendingTrack]
    is_exact_match: bool
    genre_trend_alignment: float              # 0.0 to 1.0
    bpm_trend_alignment: float                # 0.0 to 1.0
    overall_trend_score: float                # 0.0 to 100.0
    matched_remix_style: Optional[str]
    explanation: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "track_id": self.local_track.id,
            "track_title": self.local_track.title,
            "track_artist": self.local_track.artist,
            "matched_trending_track": self.matched_trending_track.to_dict() if self.matched_trending_track else None,
            "is_exact_match": self.is_exact_match,
            "genre_trend_alignment": round(self.genre_trend_alignment, 2),
            "bpm_trend_alignment": round(self.bpm_trend_alignment, 2),
            "overall_trend_score": round(self.overall_trend_score, 1),
            "matched_remix_style": self.matched_remix_style,
            "explanation": self.explanation
        }


def create_default_curated_trends() -> TrendSnapshot:
    """Built-in baseline of contemporary 2026 electronic dance music trends."""
    return TrendSnapshot(
        snapshot_id="curated_2026_baseline",
        source_name="MIXMIND Curated EDM Market Baseline 2026",
        source_type="curated_snapshot",
        timestamp=time.time(),
        freshness_days=45,
        trending_genres=[
            TrendingGenre("Melodic Techno", 1, (122.0, 126.0), 0.78, ["Emotional chords", "Arp bass", "Reverb vocal hooks"]),
            TrendingGenre("Afro House", 2, (120.0, 124.0), 0.74, ["Organic percussions", "Deep sub", "Warm chords"]),
            TrendingGenre("Tech House", 3, (125.0, 128.0), 0.82, ["Groovy basslines", "Vocal chops", "Shaker rolls"]),
            TrendingGenre("Drum & Bass", 4, (170.0, 175.0), 0.90, ["Fast breaks", "Heavy reese bass", "Double time rolls"]),
            TrendingGenre("UK Garage", 5, (130.0, 134.0), 0.80, ["2-step syncopation", "Chopped vocals", "Skippy hi-hats"]),
        ],
        trending_tracks=[
            TrendingTrack("Eternity", "Anyma", "Melodic Techno", bpm=125.0, key="8A", trend_rank=1, movement="peak"),
            TrendingTrack("Mwaki", "Zerb", "Afro House", bpm=122.0, key="9A", trend_rank=2, movement="peak"),
            TrendingTrack("Rhyme Dust", "MK & Dom Dolla", "Tech House", bpm=128.0, key="6A", trend_rank=3, movement="steady"),
            TrendingTrack("Baddadan", "Chase & Status", "Drum & Bass", bpm=174.0, key="4A", trend_rank=4, movement="peak"),
            TrendingTrack("Desire", "Calvin Harris & Sam Smith", "Trance", bpm=140.0, key="10B", trend_rank=5, movement="rising"),
        ],
        trending_remix_styles=[
            TrendingRemixStyle("Afro House Flip", "Percussive, organic 3-against-2 rhythm under classic vocal hooks", (120.0, 124.0), ["Afro House", "House", "Pop"]),
            TrendingRemixStyle("Melodic Techno Rework", "Rolling 1/16th bassline with reverb-drenched breakdown and synth drop", (123.0, 126.0), ["Melodic Techno", "EDM", "Trance"]),
            TrendingRemixStyle("Fast Techno Edit", "145+ BPM driving kick with vocal chops and high energy sweeps", (142.0, 150.0), ["Hard Techno", "Techno"]),
        ],
        popular_bpm_ranges={
            "Melodic Techno": [122.0, 126.0],
            "Afro House": [120.0, 124.0],
            "Tech House": [125.0, 128.0],
            "UK Garage": [130.0, 134.0],
            "Drum & Bass": [170.0, 175.0],
            "Festival Mainstage": [128.0, 132.0]
        },
        notes="Baseline snapshot reflecting global 2026 club and festival dance floor preferences."
    )


class TrendIntelligence:
    """
    Manages trend intelligence snapshots, provides manual import interfaces,
    evaluates freshness, and cross-references external trends against local music libraries.
    """
    def __init__(self, storage_dir: Optional[str] = None):
        self.storage_dir = storage_dir or DEFAULT_TRENDS_DIR
        os.makedirs(self.storage_dir, exist_ok=True)
        self.snapshots: Dict[str, TrendSnapshot] = {}
        self._load_all_snapshots()

    def _load_all_snapshots(self):
        """Loads all stored trend snapshots from isolated trend directory."""
        if os.path.exists(self.storage_dir):
            for fname in os.listdir(self.storage_dir):
                if fname.endswith(".json"):
                    fpath = os.path.join(self.storage_dir, fname)
                    try:
                        with open(fpath, "r", encoding="utf-8") as f:
                            data = json.load(f)
                            snap = TrendSnapshot.from_dict(data)
                            self.snapshots[snap.snapshot_id] = snap
                    except Exception as e:
                        logger.warning(f"Failed to load trend snapshot from {fname}: {e}")

        # If empty, load default curated snapshot
        if not self.snapshots:
            default_snap = create_default_curated_trends()
            self.save_snapshot(default_snap)

    def save_snapshot(self, snapshot: TrendSnapshot):
        """Saves a trend snapshot to isolated JSON storage."""
        self.snapshots[snapshot.snapshot_id] = snapshot
        fpath = os.path.join(self.storage_dir, f"{snapshot.snapshot_id}.json")
        try:
            with open(fpath, "w", encoding="utf-8") as f:
                json.dump(snapshot.to_dict(), f, indent=2)
            logger.info(f"Saved trend snapshot '{snapshot.source_name}' ({snapshot.snapshot_id})")
        except Exception as e:
            logger.error(f"Error saving snapshot {snapshot.snapshot_id}: {e}")

    def import_trend_snapshot_json(self, json_content_or_path: str) -> TrendSnapshot:
        """
        Manually imports a structured TrendSnapshot from a JSON string or file path.
        Validates structure and records source and timestamp.
        """
        if os.path.isfile(json_content_or_path):
            with open(json_content_or_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        else:
            data = json.loads(json_content_or_path)

        # Enforce valid fields
        if not isinstance(data, dict):
            raise ValueError("Trend JSON must contain a root dictionary.")

        snapshot = TrendSnapshot.from_dict(data)
        self.save_snapshot(snapshot)
        return snapshot

    def import_trend_tracks_csv(
        self,
        csv_content_or_path: str,
        source_name: str,
        genre_default: str = "EDM"
    ) -> TrendSnapshot:
        """
        Imports a DJ chart or track list from CSV (e.g. title, artist, genre, bpm, key).
        Supports common DJ chart export formats.
        """
        lines = []
        if os.path.isfile(csv_content_or_path):
            with open(csv_content_or_path, "r", encoding="utf-8", errors="replace") as f:
                reader = csv.DictReader(f)
                lines = list(reader)
        else:
            reader = csv.DictReader(csv_content_or_path.strip().splitlines())
            lines = list(reader)

        tracks: List[TrendingTrack] = []
        genres_seen: Dict[str, int] = {}

        for rank, row in enumerate(lines, start=1):
            title = row.get("title") or row.get("Track") or row.get("Name") or "Unknown"
            artist = row.get("artist") or row.get("Artist") or "Unknown"
            genre = row.get("genre") or row.get("Genre") or genre_default
            bpm_val = float(row["bpm"]) if row.get("bpm") and row["bpm"].strip() else None
            key_val = row.get("key") or row.get("Key")

            genres_seen[genre] = genres_seen.get(genre, 0) + 1

            tracks.append(TrendingTrack(
                title=title.strip(),
                artist=artist.strip(),
                genre=genre.strip(),
                bpm=bpm_val,
                key=key_val.strip() if key_val else None,
                trend_rank=rank,
                movement="peak" if rank <= 10 else "steady",
                source=source_name
            ))

        trending_genres = [
            TrendingGenre(
                genre=g,
                popularity_rank=idx + 1,
                typical_bpm_range=(122.0, 128.0),
                energy_profile=0.80
            )
            for idx, (g, count) in enumerate(sorted(genres_seen.items(), key=lambda x: x[1], reverse=True))
        ]

        snapshot_id = f"csv_import_{str(uuid.uuid4())[:8]}"
        snapshot = TrendSnapshot(
            snapshot_id=snapshot_id,
            source_name=source_name,
            source_type="manual_import",
            timestamp=time.time(),
            freshness_days=30,
            trending_genres=trending_genres,
            trending_tracks=tracks,
            notes=f"Manually imported from CSV with {len(tracks)} tracks."
        )

        self.save_snapshot(snapshot)
        return snapshot

    def get_freshness_status(self, snapshot: TrendSnapshot) -> Dict[str, Any]:
        """
        Calculates source freshness and lifecycle state.
        - 'fresh': Under 14 days old
        - 'aging': 14 to 30 days old
        - 'stale': Over 30 days old or exceeded configured freshness_days
        """
        age_seconds = time.time() - snapshot.timestamp
        age_days = round(age_seconds / 86400.0, 1)
        is_expired = age_days > snapshot.freshness_days

        if age_days <= 14.0:
            status = "fresh"
        elif age_days <= snapshot.freshness_days:
            status = "aging"
        else:
            status = "stale"

        return {
            "snapshot_id": snapshot.snapshot_id,
            "source_name": snapshot.source_name,
            "age_days": age_days,
            "freshness_status": status,
            "is_expired": is_expired,
            "freshness_limit_days": snapshot.freshness_days
        }

    def get_active_trends(self) -> List[TrendSnapshot]:
        """Returns non-expired active trend snapshots sorted by recency."""
        active = [
            s for s in self.snapshots.values()
            if not self.get_freshness_status(s)["is_expired"]
        ]
        active.sort(key=lambda s: s.timestamp, reverse=True)
        return active if active else list(self.snapshots.values())

    def get_trending_genres(self) -> List[str]:
        """Returns ordered list of currently trending genres across active snapshots."""
        genre_scores: Dict[str, float] = {}
        for snap in self.get_active_trends():
            weight = 1.0 if self.get_freshness_status(snap)["freshness_status"] == "fresh" else 0.7
            for g in snap.trending_genres:
                score = (100.0 / max(1, g.popularity_rank)) * weight
                genre_scores[g.genre] = genre_scores.get(g.genre, 0.0) + score

        sorted_genres = sorted(genre_scores.items(), key=lambda x: x[1], reverse=True)
        return [g[0] for g in sorted_genres]

    def get_trending_bpm_ranges(self) -> Dict[str, Tuple[float, float]]:
        """Returns aggregated popular BPM ranges by genre."""
        ranges: Dict[str, Tuple[float, float]] = {}
        for snap in self.get_active_trends():
            for g, r in snap.popular_bpm_ranges.items():
                if len(r) >= 2:
                    ranges[g] = (float(r[0]), float(r[1]))
            for tg in snap.trending_genres:
                if tg.genre not in ranges:
                    ranges[tg.genre] = tg.typical_bpm_range
        return ranges

    def match_track_against_trends(self, track: Track) -> TrendMatchResult:
        """
        Cross-references a single local Track against external trend intelligence.
        Checks:
        1. Exact/fuzzy track match (Does the user own this trending track?)
        2. Genre trend alignment (Is this track in a high-demand genre?)
        3. BPM trend alignment (Does it sit in the popular BPM range?)
        4. Remix style alignment (Does it match trending remix formats?)
        """
        active_snaps = self.get_active_trends()
        norm_title = track.title.lower().strip()
        norm_artist = track.artist.lower().strip()

        matched_trending: Optional[TrendingTrack] = None
        is_exact = False
        matched_remix: Optional[str] = None

        # 1. Search for Direct Track Match
        for snap in active_snaps:
            for t_track in snap.trending_tracks:
                trend_title = t_track.title.lower().strip()
                trend_artist = t_track.artist.lower().strip()

                if norm_title == trend_title or (norm_title in trend_title and norm_artist in trend_artist):
                    matched_trending = t_track
                    is_exact = True
                    break
            if is_exact:
                break

        # 2. Genre Alignment
        trending_genres = self.get_trending_genres()
        genre_alignment = 0.0
        track_genre = track.genre.strip()

        if track_genre in trending_genres:
            rank_idx = trending_genres.index(track_genre)
            genre_alignment = max(0.2, 1.0 - (rank_idx * 0.15))
        elif any(tg.lower() in track_genre.lower() for tg in trending_genres):
            genre_alignment = 0.65

        # 3. BPM Alignment
        bpm_alignment = 0.5
        bpm_ranges = self.get_trending_bpm_ranges()
        track_bpm = track.effective_bpm

        for g_name, (bpm_min, bpm_max) in bpm_ranges.items():
            if g_name.lower() in track_genre.lower() or track_genre.lower() in g_name.lower():
                if bpm_min <= track_bpm <= bpm_max:
                    bpm_alignment = 1.0
                elif abs(track_bpm - bpm_min) <= 3.0 or abs(track_bpm - bpm_max) <= 3.0:
                    bpm_alignment = 0.80
                else:
                    bpm_alignment = 0.40
                break

        # 4. Remix Style Alignment
        for snap in active_snaps:
            for style in snap.trending_remix_styles:
                min_b, max_b = style.target_bpm_range
                if min_b <= track_bpm <= max_b and any(cg.lower() in track_genre.lower() for cg in style.compatible_genres):
                    matched_remix = style.style_name
                    break
            if matched_remix:
                break

        # Calculate Overall Score (0 - 100)
        if is_exact:
            base_score = 90.0
        else:
            base_score = (genre_alignment * 50.0) + (bpm_alignment * 35.0) + (15.0 if matched_remix else 0.0)

        overall_score = round(max(0.0, min(100.0, base_score)), 1)

        # Generate Explanation
        if is_exact:
            explanation = (
                f"Direct trend hit: '{track.title}' is currently ranked #{matched_trending.trend_rank} "
                f"({matched_trending.source})."
            )
        elif genre_alignment >= 0.70 and bpm_alignment >= 0.80:
            explanation = (
                f"High trend alignment: '{track.genre}' @ {track_bpm:.1f} BPM directly matches current "
                f"market preferences ({matched_remix or 'Contemporary Club Trend'})."
            )
        elif genre_alignment >= 0.50:
            explanation = f"Moderate trend alignment: Fits trending genre '{track.genre}'."
        else:
            explanation = "Classical or timeless track; neutral market trend correlation."

        return TrendMatchResult(
            local_track=track,
            matched_trending_track=matched_trending,
            is_exact_match=is_exact,
            genre_trend_alignment=genre_alignment,
            bpm_trend_alignment=bpm_alignment,
            overall_trend_score=overall_score,
            matched_remix_style=matched_remix,
            explanation=explanation
        )

    def match_library_against_trends(self, library_tracks: List[Track]) -> List[TrendMatchResult]:
        """Cross-references the entire user local library against current trends."""
        results = [self.match_track_against_trends(t) for t in library_tracks]
        results.sort(key=lambda r: r.overall_trend_score, reverse=True)
        return results
