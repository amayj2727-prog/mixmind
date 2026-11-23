"""
Unit Tests for MIXMIND Live Mashup Engine & Stem Controller
Tests intelligent candidate search, 4-stem isolation (vocal over groove, drum/bass isolation),
harmonic/tempo evaluation, loop creation, execution gating (Copilot vs Autopilot),
offline simulation, and original audio file preservation.
"""

import os
import hashlib
import tempfile
import unittest

from backend.src.database.models import Track
from backend.src.database.db import DatabaseManager
from backend.src.dj_engine.modes import DJMode
from backend.src.remix.stems import StemController, MockStemEngine
from backend.src.remix.mashup import (
    LiveMashupEngine,
    MashupProposal,
    MashupType,
    LoopInstructions
)


class TestLiveMashupEngine(unittest.TestCase):
    def setUp(self):
        # Create temp dir and dummy audio files
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.db_path = os.path.join(self.tmp_dir.name, "test_mashup.db")
        self.db = DatabaseManager(self.db_path)

        # Audio files
        self.file_groove = os.path.join(self.tmp_dir.name, "tech_groove.mp3")
        self.file_vocal = os.path.join(self.tmp_dir.name, "acapella_anthem.mp3")
        self.file_fast = os.path.join(self.tmp_dir.name, "fast_track.mp3")
        self.file_dissonant = os.path.join(self.tmp_dir.name, "clash_track.mp3")

        dummy_audio = b"ID3\x03\x00\x00\x00\x00\x00\x10MPEG_AUDIO_STREAM_DUMMY_DATA_1234567890"
        for p in [self.file_groove, self.file_vocal, self.file_fast, self.file_dissonant]:
            with open(p, "wb") as f:
                f.write(dummy_audio)

        # Base Track: Instrumental Tech House Groove (124 BPM, 8A / A minor, low vocals)
        self.groove_track = Track(
            filepath=self.file_groove,
            filename="tech_groove.mp3",
            file_hash="hash_groove",
            title="Warehouse Bassline",
            artist="Tech Specialist",
            genre="Tech House",
            duration=300.0,
            bpm=124.0,
            camelot_key="8A",
            energy=0.78,
            danceability=0.85,
            vocal_presence=0.10,  # Pure instrumental groove bed
            cue_in=16.0,
            cue_out=280.0,
            scan_status="analyzed"
        )
        self.db.upsert_track(self.groove_track)

        # Candidate 1: High-vocal Vocal Lead Anthem (125 BPM, 8A, high vocals)
        self.vocal_track = Track(
            filepath=self.file_vocal,
            filename="acapella_anthem.mp3",
            file_hash="hash_vocal",
            title="Voices in the Dark",
            artist="Siren Sound",
            genre="Melodic House",
            duration=260.0,
            bpm=125.0,
            camelot_key="8A",
            energy=0.72,
            danceability=0.75,
            vocal_presence=0.85,  # Strong vocal lead
            cue_in=15.0,
            cue_out=240.0,
            scan_status="analyzed"
        )
        self.db.upsert_track(self.vocal_track)

        # Candidate 2: Incompatible BPM (145 BPM, >6% shift)
        self.fast_track = Track(
            filepath=self.file_fast,
            filename="fast_track.mp3",
            file_hash="hash_fast",
            title="Speed Demon",
            artist="Fast Beats",
            genre="Hard Techno",
            duration=280.0,
            bpm=145.0,
            camelot_key="8A",
            vocal_presence=0.80,
            scan_status="analyzed"
        )
        self.db.upsert_track(self.fast_track)

        # Candidate 3: Harmonic Clash (124 BPM, 3A - distance 5 on Camelot)
        self.dissonant_track = Track(
            filepath=self.file_dissonant,
            filename="clash_track.mp3",
            file_hash="hash_dissonant",
            title="Dissonant Frequencies",
            artist="Clash King",
            genre="House",
            duration=280.0,
            bpm=124.0,
            camelot_key="3A",
            vocal_presence=0.80,
            scan_status="analyzed"
        )
        self.db.upsert_track(self.dissonant_track)

        self.stem_controller = StemController()
        self.engine = LiveMashupEngine(db=self.db, stem_controller=self.stem_controller)

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_mock_stem_engine_isolation(self):
        """Verifies 4-stem isolation: vocals, instruments, bass, drums in simulation."""
        mock = MockStemEngine()
        self.assertTrue(mock.is_simulation)

        # Test initial state
        state = mock.get_state(1)
        self.assertEqual(state["vocal"], 1.0)
        self.assertEqual(state["instruments"], 1.0)
        self.assertEqual(state["bass"], 1.0)
        self.assertEqual(state["drums"], 1.0)

        # Test solo vocal (isolates vocals, mutes others)
        mock.solo_stem(1, "vocal")
        self.assertEqual(mock.get_stem(1, "vocal"), 1.0)
        self.assertEqual(mock.get_stem(1, "instruments"), 0.0)
        self.assertEqual(mock.get_stem(1, "bass"), 0.0)
        self.assertEqual(mock.get_stem(1, "drums"), 0.0)

        # Test drum isolation
        mock.solo_stem(2, "drums")
        self.assertEqual(mock.get_stem(2, "drums"), 1.0)
        self.assertEqual(mock.get_stem(2, "bass"), 0.0)

        # Test bass isolation
        mock.solo_stem(2, "bass")
        self.assertEqual(mock.get_stem(2, "bass"), 1.0)
        self.assertEqual(mock.get_stem(2, "drums"), 0.0)

        # Test restore
        mock.restore_all(1)
        self.assertEqual(mock.get_stem(1, "bass"), 1.0)

    def test_search_and_evaluate_mashup_candidates(self):
        """Verifies candidate search correctly identifies compatible pairs and rejects bad BPM/keys."""
        candidates = self.engine.search_mashup_candidates(self.groove_track, limit=5)

        # Should find vocal_track (compatible key 8A, BPM 125 vs 124 is 0.8% shift)
        cand_ids = [c.filename for c in candidates]
        self.assertIn("acapella_anthem.mp3", cand_ids)

        # Should REJECT fast_track (145 BPM exceeds 6% pitch shift limit)
        self.assertNotIn("fast_track.mp3", cand_ids)

        # Should REJECT dissonant_track (3A vs 8A is a harmonic clash)
        self.assertNotIn("clash_track.mp3", cand_ids)

    def test_structured_mashup_proposal_generation(self):
        """Verifies full generation of structured MashupProposal with stem levels, pitch, and loops."""
        proposal = self.engine.evaluate_mashup_pair(self.groove_track, self.vocal_track)
        self.assertIsNotNone(proposal)

        # Verify Track roles
        self.assertEqual(proposal.mashup_type, MashupType.VOCAL_OVER_INSTRUMENTAL)
        self.assertIn("Voices in the Dark", proposal.title)
        self.assertIn("Warehouse Bassline", proposal.title)

        # Verify Stem Allocations
        # Base deck (Instrumental groove): vocal muted (0.0), groove preserved (1.0)
        self.assertEqual(proposal.base_stem_levels["vocal"], 0.0)
        self.assertEqual(proposal.base_stem_levels["bass"], 1.0)
        self.assertEqual(proposal.base_stem_levels["drums"], 1.0)

        # Overlay deck (Acapella lead): vocal active (1.0), bass & drums muted (0.0)
        self.assertEqual(proposal.overlay_stem_levels["vocal"], 1.0)
        self.assertEqual(proposal.overlay_stem_levels["bass"], 0.0)
        self.assertEqual(proposal.overlay_stem_levels["drums"], 0.0)

        # Verify Loop & Phrase Alignment
        self.assertIsNotNone(proposal.loop_instructions)
        self.assertEqual(proposal.loop_instructions.deck, 2)
        self.assertEqual(proposal.loop_instructions.loop_length_beats, 16)
        self.assertEqual(proposal.phrase_length_beats, 32)

        # Verify Scores & Simulation Label
        self.assertGreater(proposal.compatibility_score, 80.0)
        self.assertGreater(proposal.confidence_score, 0.75)
        self.assertTrue(proposal.is_simulation)

    def test_live_mashup_suggestions_workflow(self):
        """Verifies workflow step: generating ranked live mashup suggestions for the DJ."""
        suggestions = self.engine.get_live_mashup_suggestions(self.groove_track, limit=3)
        self.assertGreaterEqual(len(suggestions), 1)

        best = suggestions[0]
        self.assertIn("title", best)
        self.assertIn("explanation", best)
        self.assertIn("base_stem_levels", best)
        self.assertIn("vocal", best["base_stem_levels"])
        self.assertGreater(best["compatibility_score"], 80.0)

    def test_execution_gatekeeping_copilot_requires_approval(self):
        """Verifies that in Copilot mode, execution is blocked without explicit user approval."""
        proposal = self.engine.evaluate_mashup_pair(self.groove_track, self.vocal_track)
        self.assertFalse(proposal.approved)

        # Attempt execution without approval -> MUST FAIL
        res = self.engine.execute_mashup(proposal, mode=DJMode.COPILOT)
        self.assertFalse(res["success"])
        self.assertIn("requires explicit user approval", res["error"].lower())

        # Now approve proposal and re-execute -> MUST SUCCEED
        approved = self.engine.approve_proposal(proposal.proposal_id)
        self.assertTrue(approved)

        res_approved = self.engine.execute_mashup(proposal, mode=DJMode.COPILOT)
        self.assertTrue(res_approved["success"])
        self.assertEqual(self.stem_controller.get_stem(1, "vocal"), 0.0)  # Base vocals muted
        self.assertEqual(self.stem_controller.get_stem(2, "vocal"), 1.0)  # Overlay vocals isolated
        self.assertEqual(self.stem_controller.get_stem(2, "bass"), 0.0)   # Overlay bass muted

    def test_execution_autopilot_rules_and_safety_checks(self):
        """Verifies that Autopilot executes high-confidence proposals and rejects unvetted ones."""
        proposal = self.engine.evaluate_mashup_pair(self.groove_track, self.vocal_track)

        # Autopilot execution on valid high-confidence proposal -> SUCCEEDS
        res = self.engine.execute_mashup(proposal, mode=DJMode.AUTOPILOT)
        self.assertTrue(res["success"])

        # Create low-confidence proposal artificially
        proposal.confidence_score = 0.50
        res_low_conf = self.engine.execute_mashup(proposal, mode=DJMode.AUTOPILOT)
        self.assertFalse(res_low_conf["success"])
        self.assertIn("confidence", res_low_conf["error"].lower())

    def test_original_audio_files_strictly_preserved(self):
        """Crucial invariant: Original user audio files must never be altered or overwritten."""
        # Calculate SHA256 hashes before mashup
        hashes_before = {}
        for p in [self.file_groove, self.file_vocal]:
            with open(p, "rb") as f:
                hashes_before[p] = hashlib.sha256(f.read()).hexdigest()

        # Run candidate evaluation, suggestions, and mashup execution
        proposal = self.engine.evaluate_mashup_pair(self.groove_track, self.vocal_track)
        self.engine.approve_proposal(proposal.proposal_id)
        self.engine.execute_mashup(proposal, mode=DJMode.COPILOT)

        # Verify SHA256 hashes after mashup are identical
        for p in [self.file_groove, self.file_vocal]:
            with open(p, "rb") as f:
                h_after = hashlib.sha256(f.read()).hexdigest()
            self.assertEqual(hashes_before[p], h_after, f"Original audio file altered: {p}")


if __name__ == "__main__":
    unittest.main()
