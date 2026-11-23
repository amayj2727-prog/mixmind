"""
Unit Tests for MIXMIND Database Layer
"""

import os
import unittest
import tempfile
import shutil

from backend.src.database.db import DatabaseManager
from backend.src.database.models import Track, MixRecord


class TestDatabaseManager(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.db_path = os.path.join(self.temp_dir, "test.db")
        self.db = DatabaseManager(self.db_path)

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def test_upsert_and_retrieve_track(self):
        track = Track(
            filepath="/music/test1.mp3",
            filename="test1.mp3",
            file_hash="hash123",
            title="Solaris",
            artist="DJ Echo",
            bpm=125.0,
            initial_key="8A",
            camelot_key="8A",
            energy=0.75,
            duration=180.0
        )
        track_id = self.db.upsert_track(track)
        self.assertIsInstance(track_id, int)

        fetched = self.db.get_track_by_path("/music/test1.mp3")
        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.title, "Solaris")
        self.assertEqual(fetched.bpm, 125.0)
        self.assertEqual(fetched.camelot_key, "8A")

    def test_record_playback_and_mix(self):
        t1 = Track(filepath="/t1.mp3", filename="t1.mp3", file_hash="h1", title="T1", artist="A1")
        t2 = Track(filepath="/t2.mp3", filename="t2.mp3", file_hash="h2", title="T2", artist="A2")
        id1 = self.db.upsert_track(t1)
        id2 = self.db.upsert_track(t2)

        self.db.record_playback(id1)
        fetched1 = self.db.get_track_by_id(id1)
        self.assertEqual(fetched1.play_count, 1)

        mix = MixRecord(
            session_id="sess_01",
            from_track_id=id1,
            to_track_id=id2,
            transition_type="bass_swap_32"
        )
        self.db.record_mix(mix)


if __name__ == "__main__":
    unittest.main()
