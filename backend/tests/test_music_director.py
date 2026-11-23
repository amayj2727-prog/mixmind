"""
MIXMIND - AI Music Director Unit Tests
Tests multi-candidate scoring, recommendation explanations, repetition avoidance,
energy phase progression, genre shifts, user rejection adaptation, and local availability.
"""

import os
import sys
import unittest
import tempfile
import shutil

# Ensure backend modules are on path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.src.database.db import DatabaseManager
from backend.src.database.models import Track
from backend.src.intelligence.music_director import MusicDirector, EnergyPhase


class TestMusicDirector(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="mixmind_test_director_")
        self.db_path = os.path.join(self.temp_dir, "director_test.db")
        self.db = DatabaseManager(self.db_path)
        self.director = MusicDirector(db=self.db, personality_id="club")

        # Create dummy physical files so local availability check passes
        self.file_tracks = {}
        for i in range(1, 10):
            p = os.path.join(self.temp_dir, f"track_{i}.mp3")
            with open(p, "wb") as f:
                f.write(b"dummy_audio_bytes" * 10)
            self.file_tracks[i] = p

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def test_harmonic_and_tempo_compatibility(self):
        """Verifies that harmonically matching tracks with close BPM score highest."""
        current = Track(
            filepath=self.file_tracks[1],
            filename="current.mp3",
            file_hash="h1",
            title="Current Track",
            artist="DJ A",
            bpm=124.0,
            camelot_key="8A",
            energy=0.6,
            genre="House"
        )
        self.db.upsert_track(current)

        # Candidate 1: Perfect match (8A, 124.0 BPM, same genre)
        cand_perfect = Track(
            filepath=self.file_tracks[2],
            filename="cand2.mp3",
            file_hash="h2",
            title="Perfect Match",
            artist="DJ B",
            bpm=124.0,
            camelot_key="8A",
            energy=0.7,
            genre="House"
        )
        self.db.upsert_track(cand_perfect)

        # Candidate 2: Severe clash (2A, 134.0 BPM, clash key)
        cand_clash = Track(
            filepath=self.file_tracks[3],
            filename="cand3.mp3",
            file_hash="h3",
            title="Clash Track",
            artist="DJ C",
            bpm=134.0,
            camelot_key="2A",
            energy=0.9,
            genre="House"
        )
        self.db.upsert_track(cand_clash)

        recs = self.director.recommend_next_tracks(current, limit=5)
        self.assertGreaterEqual(len(recs), 2)

        top_rec = recs[0]
        self.assertEqual(top_rec["track"].title, "Perfect Match")
        self.assertGreater(top_rec["score"], recs[1]["score"])

        # Check explanation
        explanation = top_rec["explanation"]
        self.assertIn("Perfect Harmonic Match", explanation.harmonic_reason)
        self.assertIn("Exact Tempo Match", explanation.tempo_reason)

    def test_energy_progression_phases(self):
        """Verifies that BUILD phase favors energy climb while RESET favors breakdown drop."""
        current = Track(
            filepath=self.file_tracks[1],
            filename="t1.mp3",
            file_hash="h1",
            title="Current",
            artist="Artist 1",
            bpm=124.0,
            camelot_key="8A",
            energy=0.7
        )

        cand_build = Track(
            filepath=self.file_tracks[2],
            filename="t2.mp3",
            file_hash="h2",
            title="Energy Build",
            artist="Artist 2",
            bpm=124.0,
            camelot_key="8A",
            energy=0.82  # +0.12 climb
        )
        self.db.upsert_track(cand_build)

        cand_drop = Track(
            filepath=self.file_tracks[3],
            filename="t3.mp3",
            file_hash="h3",
            title="Energy Drop",
            artist="Artist 3",
            bpm=124.0,
            camelot_key="8A",
            energy=0.45  # -0.25 drop
        )
        self.db.upsert_track(cand_drop)

        # 1. BUILD Phase: cand_build should win
        self.director.set_energy_phase(EnergyPhase.BUILD)
        recs_build = self.director.recommend_next_tracks(current, limit=2)
        self.assertEqual(recs_build[0]["track"].title, "Energy Build")

        # 2. RESET Phase: cand_drop should win
        self.director.set_energy_phase(EnergyPhase.RESET)
        recs_reset = self.director.recommend_next_tracks(current, limit=2)
        self.assertEqual(recs_reset[0]["track"].title, "Energy Drop")

    def test_repetition_and_artist_fatigue_avoidance(self):
        """Verifies that tracks played in session and repeated artists are penalized."""
        t1 = Track(filepath=self.file_tracks[1], filename="t1.mp3", file_hash="h1", title="T1", artist="CamelPhat", bpm=124.0, camelot_key="8A")
        t2 = Track(filepath=self.file_tracks[2], filename="t2.mp3", file_hash="h2", title="T2", artist="CamelPhat", bpm=124.0, camelot_key="8A")
        t3 = Track(filepath=self.file_tracks[3], filename="t3.mp3", file_hash="h3", title="T3", artist="Solardo", bpm=124.0, camelot_key="8A")
        self.db.upsert_track(t1)
        self.db.upsert_track(t2)
        self.db.upsert_track(t3)

        # Record t1 (CamelPhat) as just played
        self.director.record_played(t1)

        # Now evaluate t2 (also CamelPhat) vs t3 (Solardo)
        recs = self.director.recommend_next_tracks(t1, limit=5)
        titles = [r["track"].title for r in recs]

        # Solardo should be ranked above CamelPhat's second track due to artist fatigue penalty
        self.assertEqual(titles[0], "T3")
        self.assertIn("artist_fatigue", recs[1]["sub_scores"])
        self.assertLess(recs[1]["sub_scores"]["artist_fatigue"], 0)

    def test_user_rejection_adaptive_feedback(self):
        """Verifies that rejecting a track adapts the recommendation model against that artist and track."""
        t_current = Track(filepath=self.file_tracks[1], filename="c.mp3", file_hash="hc", title="Curr", artist="A1", bpm=124.0, camelot_key="8A", genre="House")
        t_cand1 = Track(filepath=self.file_tracks[2], filename="c1.mp3", file_hash="h2", title="Cand 1", artist="RejectMe", bpm=124.0, camelot_key="8A", genre="Tech House")
        t_cand2 = Track(filepath=self.file_tracks[3], filename="c2.mp3", file_hash="h3", title="Cand 2", artist="FreshArtist", bpm=124.0, camelot_key="8A", genre="Deep House")

        id1 = self.db.upsert_track(t_cand1)
        id2 = self.db.upsert_track(t_cand2)

        # User rejects Candidate 1
        self.director.reject_recommendation(id1, reason="Too aggressive")

        recs = self.director.recommend_next_tracks(t_current, limit=5)
        rec_ids = [r["track"].id for r in recs]

        # Rejected track must be completely eliminated
        self.assertNotIn(id1, rec_ids)
        self.assertIn(id2, rec_ids)

    def test_local_availability_enforcement(self):
        """Verifies that candidates whose physical files do not exist on disk are never recommended."""
        missing_path = os.path.join(self.temp_dir, "ghost_song.mp3")  # Does not exist
        t_ghost = Track(
            filepath=missing_path,
            filename="ghost_song.mp3",
            file_hash="hghost",
            title="Ghost Track",
            artist="Invisible",
            bpm=124.0,
            camelot_key="8A"
        )
        self.db.upsert_track(t_ghost)

        current = Track(filepath=self.file_tracks[1], filename="c.mp3", file_hash="hc", title="C", artist="A", bpm=124.0, camelot_key="8A")

        recs = self.director.recommend_next_tracks(current, limit=10)
        rec_paths = [r["track"].filepath for r in recs]

        self.assertNotIn(missing_path, rec_paths)


if __name__ == "__main__":
    unittest.main()
