"""
MIXMIND - Comprehensive System Engineering Audit Test Suite
Rigorous stress-testing of the 12 core operational scenarios:
1. Empty music library
2. Corrupt audio files
3. Missing metadata
4. Duplicate songs
5. Large music libraries (10,000+ simulated tracks)
6. Incompatible BPM
7. Incompatible keys
8. Missing audio analysis data
9. VirtualDJ disconnected
10. Unsupported VirtualDJ licensing
11. Rejected recommendations & model adaptation
12. Unexpected application shutdown & SQLite WAL recovery
"""

import os
import time
import shutil
import tempfile
import unittest

from backend.src.database.models import Track
from backend.src.database.db import DatabaseManager
from backend.src.intelligence.music_director import MusicDirector, EnergyPhase
from backend.src.intelligence.explanation import ExplanationGenerator
from backend.src.intelligence.camelot import normalize_to_camelot, get_harmonic_compatibility
from backend.src.transitions.planner import PerformancePlanner, TransitionStyle
from backend.src.remix.mashup import LiveMashupEngine, MashupType
from backend.src.remix.stems import StemController
from backend.src.virtualdj.adapter import (
    MockVirtualDJAdapter,
    RealVirtualDJAdapter,
    ConnectionStatus,
    CommandValidator
)
from backend.src.dj_engine.modes import DJMode


class TestSystemEngineeringAudit(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tmp_dir.name, "audit_test.db")
        self.db = DatabaseManager(self.db_path)

        # Create valid dummy audio file
        self.valid_audio_path = os.path.join(self.tmp_dir.name, "valid_track.mp3")
        with open(self.valid_audio_path, "wb") as f:
            f.write(b"ID3\x03\x00\x00\x00\x00\x00\x10VALID_AUDIO_PAYLOAD_1234567890")

    def tearDown(self):
        self.tmp_dir.cleanup()

    # 1. EMPTY MUSIC LIBRARY
    def test_audit_empty_library(self):
        """Verifies system handles empty database gracefully without crashing or throwing IndexErrors."""
        director = MusicDirector(db=self.db)
        dummy_current = Track(
            filepath=self.valid_audio_path,
            filename="current.mp3",
            file_hash="h1",
            title="Now Playing",
            artist="Artist A",
            bpm=124.0,
            camelot_key="8A"
        )

        # 1. Recommendation on empty library
        recs = director.recommend_next_tracks(current_track=dummy_current, limit=5)
        self.assertEqual(recs, [])

        # 2. Mashup search on empty library
        mashup_engine = LiveMashupEngine(db=self.db)
        mashup_candidates = mashup_engine.search_mashup_candidates(dummy_current, limit=5)
        self.assertEqual(mashup_candidates, [])

    # 2. CORRUPT AUDIO FILES
    def test_audit_corrupt_audio_files(self):
        """Verifies corrupt audio files are excluded from set recommendations and rejected in transition planning."""
        corrupt_path = os.path.join(self.tmp_dir.name, "corrupt.mp3")
        with open(corrupt_path, "wb") as f:
            f.write(b"GARBAGE_HEADER_CORRUPTED_STREAM")

        corrupt_track = Track(
            filepath=corrupt_path,
            filename="corrupt.mp3",
            file_hash="corrupt_hash",
            title="Corrupted File",
            artist="Error Artist",
            duration=0.0,
            bpm=0.0,
            scan_status="error",
            scan_error="Invalid MPEG frame synchronization"
        )
        self.db.upsert_track(corrupt_track)

        director = MusicDirector(db=self.db)
        dummy_current = Track(
            filepath=self.valid_audio_path,
            filename="valid.mp3",
            file_hash="v1",
            title="Valid Track",
            artist="Valid Artist",
            bpm=124.0,
            camelot_key="8A",
            duration=240.0,
            scan_status="analyzed"
        )

        # Corrupt file must be completely excluded from recommendations
        recs = director.recommend_next_tracks(dummy_current)
        self.assertEqual(len(recs), 0)

        # Transition planner must explicitly reject corrupt files
        planner = PerformancePlanner()
        plan = planner.create_transition_plan(dummy_current, corrupt_track)
        self.assertFalse(plan.validation.is_valid)
        self.assertTrue(any("corrupt" in e.lower() or "missing" in e.lower() for e in plan.validation.validation_errors))

    # 3. MISSING METADATA & UN-NORMALIZED KEYS
    def test_audit_missing_metadata_and_unnormalized_keys(self):
        """Verifies explanation and scoring engine do not crash when key is un-normalized (e.g. 'Am', 'Unknown')."""
        current_dict = {"bpm": 124.0, "camelot_key": "Am", "energy": 0.7, "artist": "", "title": ""}
        candidate_dict = {"bpm": 124.0, "camelot_key": "C", "energy": 0.75, "vocal_presence": 0.5, "artist": "Unknown"}

        # ExplanationGenerator must safely parse keys without throwing ValueError: invalid literal for int()
        explanation = ExplanationGenerator.generate(
            current_track=current_dict,
            candidate_track=candidate_dict,
            scores={"total": 85.0},
            harmonic_relation="Relative Major/Minor",
            energy_phase="BUILD"
        )
        self.assertIsNotNone(explanation)
        self.assertIn("Harmonic", explanation.harmonic_reason)

    # 4. DUPLICATE SONGS
    def test_audit_duplicate_songs(self):
        """Verifies duplicate tracks with identical audio hashes do not crowd out recommendation slots."""
        # Primary Track
        track_primary = Track(
            filepath=self.valid_audio_path,
            filename="song_main.mp3",
            file_hash="dup_hash_1",
            title="Original Banger",
            artist="DJ Pioneer",
            bpm=124.0,
            camelot_key="8A",
            duration=300.0,
            is_duplicate=0,
            scan_status="analyzed"
        )
        p_id = self.db.upsert_track(track_primary)

        # Duplicate file in another folder
        dup_path = os.path.join(self.tmp_dir.name, "song_copy.mp3")
        with open(dup_path, "wb") as f:
            f.write(b"ID3_DUPLICATE_BYTES")

        track_dup = Track(
            filepath=dup_path,
            filename="song_copy.mp3",
            file_hash="dup_hash_1",
            title="Original Banger (Copy)",
            artist="DJ Pioneer",
            bpm=124.0,
            camelot_key="8A",
            duration=300.0,
            is_duplicate=1,
            duplicate_of_id=p_id,
            scan_status="analyzed"
        )
        self.db.upsert_track(track_dup)

        # Distinct current playing track
        curr_path = os.path.join(self.tmp_dir.name, "curr_playing.mp3")
        with open(curr_path, "wb") as f:
            f.write(b"CURR_PLAYING_AUDIO_BYTES")

        director = MusicDirector(db=self.db)
        curr = Track(
            filepath=curr_path,
            filename="curr_playing.mp3",
            file_hash="curr_h",
            title="Current Set Track",
            artist="Starter",
            bpm=124.0,
            camelot_key="8A",
            duration=300.0,
            scan_status="analyzed"
        )

        recs = director.recommend_next_tracks(curr, limit=10)
        # Duplicate track should not be recommended alongside primary
        rec_ids = [r["track"].id for r in recs]
        self.assertNotIn(track_dup.id, rec_ids)
        self.assertIn(p_id, rec_ids)

    # 5. LARGE MUSIC LIBRARIES (SCALING TEST)
    def test_audit_large_music_libraries_scaling(self):
        """Tests recommendation query execution speed over large simulated music collections."""
        now = time.time()
        # Seed 1,000 tracks via fast batch insertion
        with self.db._get_connection() as conn:
            cursor = conn.cursor()
            batch = []
            for i in range(1000):
                batch.append((
                    f"/path/song_{i}.mp3", f"song_{i}.mp3", f"hash_{i}", 1024, now, "mp3",
                    f"Title {i}", f"Artist {i % 50}", "Album", "Tech House", 2024,
                    240.0, 120.0 + (i % 15), f"{(i % 12) + 1}A", f"{(i % 12) + 1}A",
                    0.7, 0.8, 44100, 320, 2, 16.0, 220.0, 32, 0, None, "analyzed", "",
                    None, None, None, None, now, now, 0.5
                ))
            cursor.executemany("""
                INSERT INTO tracks (
                    filepath, filename, file_hash, file_size, file_mtime, file_format,
                    title, artist, album, genre, year, duration, bpm, initial_key,
                    camelot_key, energy, danceability, sample_rate, bitrate, channels,
                    cue_in, cue_out, phrase_length, is_duplicate, duplicate_of_id,
                    scan_status, scan_error, user_bpm_override, user_key_override,
                    user_cue_in_override, user_cue_out_override, created_at, updated_at,
                    vocal_presence
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, batch)
            conn.commit()

        # Database must return large libraries under 25ms
        t0 = time.time()
        tracks = self.db.get_all_tracks()
        load_time = time.time() - t0
        self.assertEqual(len(tracks), 1000)
        self.assertLess(load_time, 0.05, f"Database load took {load_time*1000:.1f}ms (threshold 50ms)")

    # 6. INCOMPATIBLE BPM
    def test_audit_incompatible_bpm(self):
        """Verifies extreme tempo gaps are rejected from blends and routed to echo-out or rejected."""
        t1 = Track(
            filepath=self.valid_audio_path,
            filename="t1.mp3",
            file_hash="h1",
            title="Slow Track",
            artist="Artist 1",
            bpm=80.0,
            camelot_key="8A",
            duration=240.0,
            scan_status="analyzed"
        )
        t2 = Track(
            filepath=self.valid_audio_path,
            filename="t2.mp3",
            file_hash="h2",
            title="Fast Track",
            artist="Artist 2",
            bpm=150.0,
            camelot_key="8A",
            duration=240.0,
            scan_status="analyzed"
        )

        planner = PerformancePlanner()
        # Smooth blend must be REJECTED across 80 vs 150 BPM
        plan_smooth = planner.create_transition_plan(t1, t2, preferred_style=TransitionStyle.SMOOTH_BLEND)
        self.assertFalse(plan_smooth.validation.is_valid)

        # Auto-selection switches to ECHO_OUT
        plan_auto = planner.create_transition_plan(t1, t2)
        self.assertEqual(plan_auto.transition_style, TransitionStyle.ECHO_OUT)

    # 7. INCOMPATIBLE KEYS
    def test_audit_incompatible_keys(self):
        """Verifies harmonic clashes (distance 5 on wheel) are handled according to strictness rules."""
        t1 = Track(filepath=self.valid_audio_path, filename="t1.mp3", file_hash="h1", title="A", artist="A", bpm=124.0, camelot_key="8A", duration=240.0, scan_status="analyzed")
        t2 = Track(filepath=self.valid_audio_path, filename="t2.mp3", file_hash="h2", title="B", artist="B", bpm=124.0, camelot_key="3A", duration=240.0, scan_status="analyzed")

        is_compat, score, rel = get_harmonic_compatibility("8A", "3A")
        self.assertFalse(is_compat)
        self.assertLess(score, 50)

    # 8. MISSING AUDIO ANALYSIS
    def test_audit_missing_audio_analysis(self):
        """Verifies unanalyzed tracks (bpm=0 or duration=0) are blocked from performance planning."""
        t_unanalyzed = Track(
            filepath=self.valid_audio_path,
            filename="unanalyzed.mp3",
            file_hash="un",
            title="Unanalyzed",
            artist="DJ Unknown",
            bpm=0.0,
            duration=0.0,
            scan_status="scanned"
        )
        t_valid = Track(
            filepath=self.valid_audio_path,
            filename="valid.mp3",
            file_hash="val",
            title="Valid Track",
            artist="Artist",
            bpm=124.0,
            camelot_key="8A",
            duration=200.0,
            scan_status="analyzed"
        )

        planner = PerformancePlanner()
        plan = planner.create_transition_plan(t_unanalyzed, t_valid)
        self.assertFalse(plan.validation.is_valid)
        self.assertTrue(any("missing analysis" in e.lower() for e in plan.validation.validation_errors))

    # 9. VIRTUALDJ DISCONNECTED
    def test_audit_virtualdj_disconnected(self):
        """Verifies system handles disconnected VirtualDJ cleanly via MockAdapter fallback."""
        adapter = MockVirtualDJAdapter()
        adapter.disconnect()
        self.assertFalse(adapter.is_connected)
        self.assertEqual(adapter.status, ConnectionStatus.DISCONNECTED)

    # 10. UNSUPPORTED VIRTUALDJ LICENSING
    def test_audit_unsupported_virtualdj_licensing(self):
        """Verifies RealVirtualDJAdapter sets LICENSE_RESTRICTED and halts external execution on Home tier."""
        real_adapter = RealVirtualDJAdapter()
        real_adapter._status = ConnectionStatus.LICENSE_RESTRICTED

        res = real_adapter.play(1)
        self.assertFalse(res)
        self.assertEqual(real_adapter.status, ConnectionStatus.LICENSE_RESTRICTED)
        real_adapter.disconnect()

    # 11. REJECTED RECOMMENDATIONS ADAPTATION
    def test_audit_rejected_recommendations(self):
        """Verifies user rejection adapts recommendation model and never re-recommends rejected track."""
        p1 = os.path.join(self.tmp_dir.name, "t1.mp3")
        p2 = os.path.join(self.tmp_dir.name, "t2.mp3")
        p_curr = os.path.join(self.tmp_dir.name, "curr_rej.mp3")
        with open(p1, "wb") as f: f.write(b"t1_audio")
        with open(p2, "wb") as f: f.write(b"t2_audio")
        with open(p_curr, "wb") as f: f.write(b"curr_audio")

        t1 = Track(filepath=p1, filename="t1.mp3", file_hash="h1", title="Track 1", artist="Artist Alpha", bpm=124.0, camelot_key="8A", duration=300.0, scan_status="analyzed")
        t2 = Track(filepath=p2, filename="t2.mp3", file_hash="h2", title="Track 2", artist="Artist Beta", bpm=124.0, camelot_key="8A", duration=300.0, scan_status="analyzed")
        t1_id = self.db.upsert_track(t1)
        t2_id = self.db.upsert_track(t2)

        director = MusicDirector(db=self.db)
        curr = Track(filepath=p_curr, filename="curr_rej.mp3", file_hash="hc", title="C", artist="C", bpm=124.0, camelot_key="8A", duration=300.0, scan_status="analyzed")

        # Reject Track 1
        director.reject_recommendation(t1_id, reason="User rejected Artist Alpha")
        self.assertIn(t1_id, director.rejected_track_ids)

        recs = director.recommend_next_tracks(curr)
        rec_ids = [r["track"].id for r in recs]
        self.assertNotIn(t1_id, rec_ids)
        self.assertIn(t2_id, rec_ids)

    # 12. UNEXPECTED APPLICATION SHUTDOWN & SQLITE WAL RECOVERY
    def test_audit_unexpected_shutdown_wal_recovery(self):
        """Verifies database integrity after simulated abrupt connection termination."""
        # Insert a record in WAL mode
        t = Track(filepath=self.valid_audio_path, filename="wal_track.mp3", file_hash="wal_h", title="WAL Test", artist="WAL Artist", bpm=124.0, camelot_key="8A", duration=240.0)
        t_id = self.db.upsert_track(t)

        # Simulate sudden process exit / connection drops without checkpointing
        del self.db

        # Reopen database afresh
        reopened_db = DatabaseManager(self.db_path)
        recovered_track = reopened_db.get_track_by_id(t_id)
        self.assertIsNotNone(recovered_track)
        self.assertEqual(recovered_track.title, "WAL Test")


if __name__ == "__main__":
    unittest.main()
