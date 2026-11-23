"""
MIXMIND - DJ Personality Engine Unit Tests
Proves that different personalities produce meaningfully different decisions using the same music library,
and verifies custom personality creation, validation, and persistence.
"""

import os
import sys
import unittest
import tempfile
import shutil

# Ensure backend modules are on path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.src.intelligence.personalities import (
    MELODIC_DJ,
    FESTIVAL_DJ,
    CLUB_DJ,
    PersonalityRegistry,
    DJPersonality,
    TransitionProfile,
)


class TestDJPersonalityEngine(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="mixmind_test_pers_")
        self.storage_path = os.path.join(self.temp_dir, "custom_personalities.json")
        self.registry = PersonalityRegistry(storage_path=self.storage_path)

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def test_personalities_make_distinct_decisions_on_same_library(self):
        """
        CRITICAL TEST: Proves that given the EXACT same candidate tracks,
        Melodic, Festival, and Club personalities rank different tracks as #1!
        """
        current_track = {
            "title": "Current Groove",
            "bpm": 124.0,
            "camelot_key": "8A",
            "energy": 0.65,
            "genre": "house"
        }

        # Track 1: Melodic House, 123 BPM, exact key 8A, moderate emotional energy (0.68), vocal presence (0.80)
        track_melodic = {
            "filepath": "/music/melodic.mp3",
            "title": "Melodic Sunrise",
            "artist": "Gorgon City",
            "bpm": 123.0,
            "camelot_key": "8A",
            "energy": 0.68,
            "genre": "melodic house",
            "vocal_presence": 0.80
        }

        # Track 2: High-Energy Festival Banger, 128 BPM, energy boost key 10A, peak energy (0.95), instrumental (0.15)
        track_festival = {
            "filepath": "/music/festival.mp3",
            "title": "Mainstage Drop",
            "artist": "Martin Garrix",
            "bpm": 128.0,
            "camelot_key": "10A",
            "energy": 0.95,
            "genre": "edm",
            "vocal_presence": 0.15
        }

        # Track 3: Steady Tech-House Groove, 124 BPM, exact key 8A, steady energy (0.65), low vocal (0.20)
        track_club = {
            "filepath": "/music/club.mp3",
            "title": "Warehouse Hypnosis",
            "artist": "Fisher",
            "bpm": 124.0,
            "camelot_key": "8A",
            "energy": 0.65,
            "genre": "tech house",
            "vocal_presence": 0.20
        }

        candidates = [track_melodic, track_festival, track_club]

        # 1. Melodic DJ Decision
        melodic_scores = {c["title"]: MELODIC_DJ.score_track(current_track, c, []) for c in candidates}
        melodic_best = max(melodic_scores, key=melodic_scores.get)
        self.assertEqual(melodic_best, "Melodic Sunrise", "Melodic DJ failed to prioritize melodic vocal track!")

        # 2. Festival DJ Decision
        festival_scores = {c["title"]: FESTIVAL_DJ.score_track(current_track, c, []) for c in candidates}
        festival_best = max(festival_scores, key=festival_scores.get)
        self.assertEqual(festival_best, "Mainstage Drop", "Festival DJ failed to prioritize peak-energy banger!")

        # 3. Club DJ Decision
        club_scores = {c["title"]: CLUB_DJ.score_track(current_track, c, []) for c in candidates}
        club_best = max(club_scores, key=club_scores.get)
        self.assertEqual(club_best, "Warehouse Hypnosis", "Club DJ failed to prioritize tech-house groove track!")

        # Verify that all 3 personalities chose different top tracks
        distinct_choices = {melodic_best, festival_best, club_best}
        self.assertEqual(len(distinct_choices), 3, "Personalities did not produce distinct decisions!")

    def test_transition_plans_differ_by_personality(self):
        """Proves that personalities generate distinct transition phrase lengths, curves, and filter depths."""
        curr = {"bpm": 124.0, "key": "8A"}
        nxt = {"bpm": 125.0, "key": "8A"}

        plan_melodic = MELODIC_DJ.create_transition_plan(curr, nxt)
        plan_festival = FESTIVAL_DJ.create_transition_plan(curr, nxt)
        plan_club = CLUB_DJ.create_transition_plan(curr, nxt)

        # Melodic: 64 beats long blend, gentle filter (0.70), s-curve
        self.assertEqual(plan_melodic.total_beats, 64)
        self.assertEqual(plan_melodic.curve_type, "s_curve")
        self.assertAlmostEqual(plan_melodic.filter_max, 0.70)
        self.assertEqual(plan_melodic.bass_swap_mode, "gradual_crossfade")

        # Festival: 32 beats, intense high-pass filter (1.00), heavy vocal ducking (0.90), instant downbeat swap
        self.assertEqual(plan_festival.total_beats, 32)
        self.assertAlmostEqual(plan_festival.filter_max, 1.00)
        self.assertAlmostEqual(plan_festival.vocal_ducking_depth, 0.90)
        self.assertEqual(plan_festival.bass_swap_mode, "instant_downbeat")

        # Club: 32 beats, restrained filter (0.75), linear curve
        self.assertEqual(plan_club.total_beats, 32)
        self.assertAlmostEqual(plan_club.filter_max, 0.75)
        self.assertEqual(plan_club.curve_type, "linear")

    def test_custom_personality_creation_and_persistence(self):
        """Verifies registering, persisting, and querying user-defined custom personalities."""
        custom_config = {
            "id": "sunset_chill",
            "name": "Sunset Chill DJ",
            "description": "Ibiza sunset session with organic deep house and gentle transitions.",
            "preferred_genres": ["deep house", "organic house", "downtempo"],
            "energy_range": (0.30, 0.60),
            "target_bpm_range": (115.0, 122.0),
            "max_bpm_jump": 2.5,
            "harmonic_strictness": 2.0,
            "energy_target_slope": -0.05,
            "preferred_phrase_length": 64,
            "progression_strategy": "harmonic_flow",
            "transition": {
                "total_beats": 64,
                "intro_beats": 32,
                "buildup_beats": 16,
                "outro_beats": 16,
                "filter_sweep_intensity": 0.15,
                "vocal_ducking_depth": 0.30,
                "bass_swap_mode": "gradual_crossfade"
            }
        }

        # 1. Register custom personality
        created = self.registry.register_custom(custom_config)
        self.assertEqual(created.id, "sunset_chill")
        self.assertTrue(created.is_custom)

        # 2. Query from registry
        retrieved = self.registry.get("sunset_chill")
        self.assertEqual(retrieved.name, "Sunset Chill DJ")
        self.assertEqual(retrieved.preferred_phrase_length, 64)

        # 3. Verify disk persistence across new registry instances
        new_registry = PersonalityRegistry(storage_path=self.storage_path)
        pers_from_disk = new_registry.get("sunset_chill")
        self.assertEqual(pers_from_disk.name, "Sunset Chill DJ")
        self.assertEqual(pers_from_disk.energy_range, (0.30, 0.60))

        # 4. Delete custom personality
        deleted = new_registry.delete_custom("sunset_chill")
        self.assertTrue(deleted)
        # Should now fallback to Club DJ default
        self.assertEqual(new_registry.get("sunset_chill").id, "club")

    def test_custom_personality_validation(self):
        """Verifies validation rules for custom personalities."""
        # Missing ID
        val, err = self.registry.validate_config({"name": "No ID"})
        self.assertFalse(val)

        # Cannot overwrite built-ins
        val, err = self.registry.validate_config({"id": "club", "name": "Fake Club"})
        self.assertFalse(val)
        self.assertIn("built-in", err)

        # Invalid BPM range (min > max)
        val, err = self.registry.validate_config({
            "id": "bad_bpm",
            "name": "Bad BPM",
            "target_bpm_range": (130.0, 120.0)
        })
        self.assertFalse(val)

        # Invalid energy range (> 1.0)
        val, err = self.registry.validate_config({
            "id": "bad_energy",
            "name": "Bad Energy",
            "energy_range": (0.0, 1.5)
        })
        self.assertFalse(val)


if __name__ == "__main__":
    unittest.main()
