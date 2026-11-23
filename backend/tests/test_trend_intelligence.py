"""
Unit Tests for MIXMIND Trend Intelligence System
Verifies isolated trend storage, manual JSON and CSV import interfaces,
source provenance and freshness tracking, local library trend matching,
and strict non-assumption of track ownership.
"""

import os
import json
import time
import tempfile
import unittest

from backend.src.database.models import Track
from backend.src.database.db import DatabaseManager
from backend.src.intelligence.trend_intelligence import (
    TrendIntelligence,
    TrendSnapshot,
    TrendingGenre,
    TrendingTrack,
    TrendingRemixStyle,
    create_default_curated_trends
)


class TestTrendIntelligence(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.storage_dir = os.path.join(self.tmp_dir.name, "trends")
        self.db_path = os.path.join(self.tmp_dir.name, "user_library.db")

        self.db = DatabaseManager(self.db_path)
        self.trend_intel = TrendIntelligence(storage_dir=self.storage_dir)

        # Create dummy user tracks in the user library
        self.track_owned_trend = Track(
            filepath=os.path.join(self.tmp_dir.name, "eternity.mp3"),
            filename="eternity.mp3",
            file_hash="hash_eternity",
            title="Eternity",
            artist="Anyma",
            genre="Melodic Techno",
            bpm=125.0,
            camelot_key="8A",
            duration=300.0,
            scan_status="analyzed"
        )
        with open(self.track_owned_trend.filepath, "wb") as f:
            f.write(b"ID3dummy")
        self.db.upsert_track(self.track_owned_trend)

        self.track_genre_match = Track(
            filepath=os.path.join(self.tmp_dir.name, "afro_deep.mp3"),
            filename="afro_deep.mp3",
            file_hash="hash_afro",
            title="Savannah Sunset",
            artist="Tribal Sound",
            genre="Afro House",
            bpm=122.0,
            camelot_key="9A",
            duration=290.0,
            scan_status="analyzed"
        )
        with open(self.track_genre_match.filepath, "wb") as f:
            f.write(b"ID3dummy")
        self.db.upsert_track(self.track_genre_match)

        self.track_classic = Track(
            filepath=os.path.join(self.tmp_dir.name, "classic_rock.mp3"),
            filename="classic_rock.mp3",
            file_hash="hash_rock",
            title="Vintage Guitar Solo",
            artist="The 70s Band",
            genre="Classic Rock",
            bpm=95.0,
            camelot_key="5B",
            duration=240.0,
            scan_status="analyzed"
        )
        with open(self.track_classic.filepath, "wb") as f:
            f.write(b"ID3dummy")
        self.db.upsert_track(self.track_classic)

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_isolated_trend_storage_never_pollutes_user_library(self):
        """Verifies trend data resides in an isolated directory and never pollutes user library DB."""
        # Check that user database only has the 3 tracks added
        all_user_tracks = self.db.get_all_tracks()
        self.assertEqual(len(all_user_tracks), 3)

        # Stored trends are saved as JSON in self.storage_dir
        json_files = [f for f in os.listdir(self.storage_dir) if f.endswith(".json")]
        self.assertGreaterEqual(len(json_files), 1)

        # None of the trending tracks in the snapshot are inserted into mixmind.db
        titles_in_db = {t.title for t in all_user_tracks}
        self.assertNotIn("Baddadan", titles_in_db)
        self.assertNotIn("Mwaki", titles_in_db)

    def test_manual_json_snapshot_import(self):
        """Verifies manual import of a custom TrendSnapshot from JSON."""
        custom_json = {
            "snapshot_id": "test_fest_2026",
            "source_name": "Tomorrowland 2026 Warmup Chart",
            "source_type": "manual_import",
            "timestamp": time.time(),
            "freshness_days": 21,
            "trending_genres": [
                {
                    "genre": "Hard Techno",
                    "popularity_rank": 1,
                    "typical_bpm_range": [145.0, 155.0],
                    "energy_profile": 0.95,
                    "key_characteristics": ["Industrial kicks", "Acid bass"]
                }
            ],
            "trending_tracks": [
                {
                    "title": "Industrial Rage",
                    "artist": "KlangKuenstler",
                    "genre": "Hard Techno",
                    "bpm": 150.0,
                    "key": "4A",
                    "trend_rank": 1,
                    "movement": "peak",
                    "source": "Tomorrowland 2026 Warmup Chart"
                }
            ],
            "trending_remix_styles": [
                {
                    "style_name": "Hard Techno Edit",
                    "description": "Distorted 909 kick under classic trance hook",
                    "target_bpm_range": [148.0, 152.0],
                    "compatible_genres": ["Hard Techno", "Trance"]
                }
            ],
            "popular_bpm_ranges": {
                "Hard Techno": [145.0, 155.0]
            },
            "notes": "Verified festival stage trend."
        }

        snapshot = self.trend_intel.import_trend_snapshot_json(json.dumps(custom_json))
        self.assertEqual(snapshot.snapshot_id, "test_fest_2026")
        self.assertEqual(snapshot.source_name, "Tomorrowland 2026 Warmup Chart")
        self.assertEqual(len(snapshot.trending_genres), 1)
        self.assertEqual(snapshot.trending_genres[0].genre, "Hard Techno")
        self.assertEqual(len(snapshot.trending_tracks), 1)

        # Verify persisted on disk
        persisted_file = os.path.join(self.storage_dir, "test_fest_2026.json")
        self.assertTrue(os.path.exists(persisted_file))

    def test_manual_csv_chart_import(self):
        """Verifies manual import of DJ charts from CSV."""
        csv_data = """title,artist,genre,bpm,key
Laserbeam,Ray Volpe,Dubstep,145,1A
Rumble,Skrillex & Fred again..,Bass House,140,8A
Miracle,Calvin Harris & Ellie Goulding,Trance,143,10B
"""
        snapshot = self.trend_intel.import_trend_tracks_csv(
            csv_content_or_path=csv_data,
            source_name="Beatport Top 3 Export",
            genre_default="Dance"
        )

        self.assertEqual(snapshot.source_name, "Beatport Top 3 Export")
        self.assertEqual(len(snapshot.trending_tracks), 3)
        self.assertEqual(snapshot.trending_tracks[0].title, "Laserbeam")
        self.assertEqual(snapshot.trending_tracks[0].trend_rank, 1)
        self.assertEqual(snapshot.trending_tracks[1].artist, "Skrillex & Fred again..")

    def test_source_provenance_and_freshness_lifecycle(self):
        """Verifies freshness calculation: fresh, aging, and stale/expired."""
        # Case 1: Fresh snapshot (0 days old)
        fresh_snap = TrendSnapshot(
            snapshot_id="fresh_test",
            source_name="Fresh Chart",
            source_type="manual_import",
            timestamp=time.time(),
            freshness_days=30
        )
        status_fresh = self.trend_intel.get_freshness_status(fresh_snap)
        self.assertEqual(status_fresh["freshness_status"], "fresh")
        self.assertFalse(status_fresh["is_expired"])

        # Case 2: Aging snapshot (20 days old)
        aging_snap = TrendSnapshot(
            snapshot_id="aging_test",
            source_name="Aging Chart",
            source_type="manual_import",
            timestamp=time.time() - (20 * 86400),
            freshness_days=30
        )
        status_aging = self.trend_intel.get_freshness_status(aging_snap)
        self.assertEqual(status_aging["freshness_status"], "aging")
        self.assertFalse(status_aging["is_expired"])

        # Case 3: Stale / Expired snapshot (45 days old with 30 day TTL)
        stale_snap = TrendSnapshot(
            snapshot_id="stale_test",
            source_name="Stale Chart",
            source_type="manual_import",
            timestamp=time.time() - (45 * 86400),
            freshness_days=30
        )
        status_stale = self.trend_intel.get_freshness_status(stale_snap)
        self.assertEqual(status_stale["freshness_status"], "stale")
        self.assertTrue(status_stale["is_expired"])

    def test_matching_library_tracks_against_trends(self):
        """Verifies cross-referencing user library tracks against trend intelligence."""
        # 1. Direct Hit Match: User owns 'Eternity' by Anyma
        res_direct = self.trend_intel.match_track_against_trends(self.track_owned_trend)
        self.assertTrue(res_direct.is_exact_match)
        self.assertIsNotNone(res_direct.matched_trending_track)
        self.assertEqual(res_direct.matched_trending_track.title, "Eternity")
        self.assertGreaterEqual(res_direct.overall_trend_score, 90.0)
        self.assertIn("Direct trend hit", res_direct.explanation)

        # 2. Genre & BPM Alignment: User owns an Afro House track @ 122 BPM
        res_genre = self.trend_intel.match_track_against_trends(self.track_genre_match)
        self.assertFalse(res_genre.is_exact_match)
        self.assertGreaterEqual(res_genre.genre_trend_alignment, 0.70)
        self.assertEqual(res_genre.bpm_trend_alignment, 1.0)
        self.assertGreaterEqual(res_genre.overall_trend_score, 75.0)
        self.assertIn("Afro House", res_genre.explanation)

        # 3. Unaligned Classic Rock Track
        res_classic = self.trend_intel.match_track_against_trends(self.track_classic)
        self.assertFalse(res_classic.is_exact_match)
        self.assertEqual(res_classic.genre_trend_alignment, 0.0)
        self.assertLess(res_classic.overall_trend_score, 40.0)

    def test_never_assumes_trending_track_exists_in_library(self):
        """Ensures that query for trending tracks does not assume local availability."""
        # Top trending track 'Mwaki' is in default snapshot, but user does NOT have it
        user_library = self.db.get_all_tracks()
        titles = [t.title for t in user_library]
        self.assertNotIn("Mwaki", titles)

        # When matching library, no track should be falsely claimed as 'Mwaki'
        matches = self.trend_intel.match_library_against_trends(user_library)
        matched_mwaki = [m for m in matches if m.is_exact_match and m.matched_trending_track.title == "Mwaki"]
        self.assertEqual(len(matched_mwaki), 0)


if __name__ == "__main__":
    unittest.main()
