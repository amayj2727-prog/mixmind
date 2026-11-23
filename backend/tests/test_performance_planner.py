"""
Unit Tests for MIXMIND Performance Planner & Structured Transition Architect
Tests transition plan generation across styles, mathematical curves,
and strict validation against incompatible songs, extreme tempo differences, and missing analysis data.
"""

import os
import tempfile
import unittest

from backend.src.database.models import Track
from backend.src.intelligence.personalities import get_personality
from backend.src.transitions.planner import (
    PerformancePlanner,
    StructuredTransitionPlan,
    TransitionStyle,
    StemInstructions,
    EQInstructions,
    EffectsInstructions,
    ValidationResult
)
from backend.src.transitions.curves import (
    linear_curve,
    exponential_curve,
    s_curve,
    logarithmic_curve,
    filter_sweep_curve
)


class TestPerformancePlanner(unittest.TestCase):
    def setUp(self):
        # Create temp audio files to satisfy physical file existence check
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.file_a = os.path.join(self.tmp_dir.name, "track_a.mp3")
        self.file_b = os.path.join(self.tmp_dir.name, "track_b.mp3")
        self.file_c = os.path.join(self.tmp_dir.name, "track_c.mp3")

        with open(self.file_a, "wb") as f:
            f.write(b"ID3dummydata")
        with open(self.file_b, "wb") as f:
            f.write(b"ID3dummydata")
        with open(self.file_c, "wb") as f:
            f.write(b"ID3dummydata")

        # Standard compatible tracks (124 BPM, House, 8A / A minor)
        self.track_1 = Track(
            filepath=self.file_a,
            filename="track_a.mp3",
            file_hash="hash_a",
            title="Deep Resonance",
            artist="DJ Pulse",
            genre="House",
            duration=300.0,
            bpm=124.0,
            camelot_key="8A",
            energy=0.72,
            danceability=0.80,
            vocal_presence=0.20,
            cue_in=15.0,
            cue_out=270.0,
            scan_status="analyzed"
        )

        self.track_2 = Track(
            filepath=self.file_b,
            filename="track_b.mp3",
            file_hash="hash_b",
            title="Hypnotic Groove",
            artist="Stereo Soul",
            genre="Tech House",
            duration=320.0,
            bpm=125.0,
            camelot_key="9A",  # Camelot adjacent (+1 on wheel)
            energy=0.75,
            danceability=0.82,
            vocal_presence=0.15,
            cue_in=16.0,
            cue_out=290.0,
            scan_status="analyzed"
        )

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_mathematical_curves(self):
        """Verify mathematical curves adhere to boundary values and progression."""
        # Boundaries: progress = 0.0 -> start_val, progress = 1.0 -> end_val
        for curve_fn in [linear_curve, exponential_curve, s_curve, logarithmic_curve]:
            self.assertAlmostEqual(curve_fn(0.0, 10.0, 20.0), 10.0)
            self.assertAlmostEqual(curve_fn(1.0, 10.0, 20.0), 20.0)

        # S-curve midpoint should equal linear midpoint for symmetric interpolation
        self.assertAlmostEqual(s_curve(0.5, 0.0, 1.0), 0.5, places=4)
        # S-curve should be gentler than linear at the start (e.g. p=0.2: 3*(0.04) - 2*(0.008) = 0.104 < 0.2)
        self.assertLess(s_curve(0.2, 0.0, 1.0), linear_curve(0.2, 0.0, 1.0))

        # Logarithmic curve rises rapidly in early phase
        self.assertGreater(logarithmic_curve(0.2, 0.0, 1.0), linear_curve(0.2, 0.0, 1.0))

        # Filter sweep curve
        sweep = filter_sweep_curve(0.5, 0.5, 1.0)
        self.assertGreater(sweep, 0.5)
        self.assertLess(sweep, 1.0)

    def test_complete_10_point_transition_plan(self):
        """Test generation of the full 10-point structured transition blueprint."""
        planner = PerformancePlanner(personality=get_personality("club"))
        plan = planner.create_transition_plan(self.track_1, self.track_2)

        # 1. Tracks
        self.assertEqual(plan.current_track["title"], "Deep Resonance")
        self.assertEqual(plan.incoming_track["title"], "Hypnotic Groove")

        # 2. Timing
        self.assertGreater(plan.recommended_transition_start, 0.0)
        self.assertLess(plan.recommended_transition_start, self.track_1.duration)
        self.assertEqual(plan.duration_beats, 32)
        self.assertGreater(plan.duration_seconds, 0.0)

        # 3. Tempo & Pitch
        self.assertEqual(plan.target_bpm, 124.5)
        self.assertAlmostEqual(plan.current_pitch_shift_pct, 0.40, places=1)
        self.assertAlmostEqual(plan.incoming_pitch_shift_pct, -0.40, places=1)

        # 4. Harmonic Key Compatibility
        self.assertTrue(plan.key_compatibility["is_compatible"])
        self.assertIn("Blend", plan.key_compatibility["relationship"])

        # 5. Phrase Alignment
        self.assertEqual(plan.phrase_compatibility["phrase_length_beats"], 32)
        self.assertTrue(plan.phrase_compatibility["sync_downbeat"])

        # 6. Stem Requirements
        self.assertIsInstance(plan.stem_requirements, StemInstructions)
        self.assertIn("vocal", plan.stem_requirements.outgoing_stems)
        self.assertIn("bass", plan.stem_requirements.incoming_stems)

        # 7. EQ Instructions
        self.assertIsInstance(plan.eq_instructions, EQInstructions)
        self.assertIn(plan.eq_instructions.low_strategy, ["instant_downbeat", "gradual_crossfade"])

        # 8. Effects Instructions
        self.assertIsInstance(plan.effects_instructions, EffectsInstructions)
        self.assertIn(plan.effects_instructions.primary_effect, ["filter_hpf", "reverb_wash", "echo_freeze"])

        # 9. Loop Opportunity
        # In subtle BPM differences, loop opportunity may be optional or defined
        plan_dict = plan.to_dict()
        self.assertIn("loop_opportunity", plan_dict)

        # 10. Validation & Confidence
        self.assertTrue(plan.validation.is_valid)
        self.assertGreater(plan.validation.confidence_score, 0.8)
        self.assertEqual(len(plan.validation.validation_errors), 0)

    def test_transition_styles(self):
        """Test each supported transition style configuration."""
        planner = PerformancePlanner()

        # 1. Extended Mix (Melodic style)
        plan_ext = planner.create_transition_plan(
            self.track_1, self.track_2, preferred_style=TransitionStyle.EXTENDED_MIX
        )
        self.assertEqual(plan_ext.transition_style, TransitionStyle.EXTENDED_MIX)
        self.assertEqual(plan_ext.duration_beats, 64)
        self.assertEqual(plan_ext.eq_instructions.low_strategy, "gradual_crossfade")
        self.assertEqual(plan_ext.eq_instructions.mid_crossfade_curve, "s_curve")
        self.assertEqual(plan_ext.effects_instructions.primary_effect, "reverb_wash")

        # 2. Echo Out (for tempo jumps / quick washouts)
        plan_echo = planner.create_transition_plan(
            self.track_1, self.track_2, preferred_style=TransitionStyle.ECHO_OUT
        )
        self.assertEqual(plan_echo.transition_style, TransitionStyle.ECHO_OUT)
        self.assertEqual(plan_echo.duration_beats, 16)
        self.assertEqual(plan_echo.effects_instructions.primary_effect, "echo_freeze")
        self.assertEqual(plan_echo.effects_instructions.echo_beats, 0.75)  # 3/4 dotted delay

        # 3. Buildup Drop (Festival style)
        plan_drop = planner.create_transition_plan(
            self.track_1, self.track_2, preferred_style=TransitionStyle.BUILDUP_DROP
        )
        self.assertEqual(plan_drop.transition_style, TransitionStyle.BUILDUP_DROP)
        self.assertGreaterEqual(plan_drop.effects_instructions.filter_max, 0.90)

        # 4. Vocal Overlay
        vocal_track = Track(
            filepath=self.file_c,
            filename="track_c.mp3",
            file_hash="hash_c",
            title="Acapella Lead",
            artist="Vocal Star",
            duration=200.0,
            bpm=124.0,
            camelot_key="8A",
            vocal_presence=0.88,
            scan_status="analyzed"
        )
        plan_vocal = planner.create_transition_plan(
            self.track_1, vocal_track, preferred_style=TransitionStyle.VOCAL_OVERLAY
        )
        self.assertEqual(plan_vocal.transition_style, TransitionStyle.VOCAL_OVERLAY)
        self.assertTrue(plan_vocal.stem_requirements.vocal_overlay_active)
        self.assertEqual(plan_vocal.stem_requirements.outgoing_stems["vocal"], 0.0)
        self.assertEqual(plan_vocal.stem_requirements.incoming_stems["vocal"], 1.0)

        # 5. Loop Based
        plan_loop = planner.create_transition_plan(
            self.track_1, self.track_2, preferred_style=TransitionStyle.LOOP_BASED
        )
        self.assertEqual(plan_loop.transition_style, TransitionStyle.LOOP_BASED)
        self.assertIsNotNone(plan_loop.loop_opportunity)
        self.assertEqual(plan_loop.loop_opportunity["deck"], "incoming")

    def test_validation_rejection_missing_analysis_data(self):
        """Ensure unanalyzed, zero duration, or missing audio files are strictly rejected."""
        planner = PerformancePlanner()

        # Case 1: Duration <= 0
        corrupt_dur = Track(
            filepath=self.file_a,
            filename="a.mp3",
            file_hash="h1",
            title="Corrupt Dur",
            artist="Test",
            duration=0.0,
            bpm=124.0,
            camelot_key="8A",
            scan_status="analyzed"
        )
        plan1 = planner.create_transition_plan(corrupt_dur, self.track_2)
        self.assertFalse(plan1.validation.is_valid)
        self.assertEqual(plan1.validation.confidence_score, 0.0)
        self.assertTrue(any("duration" in e.lower() for e in plan1.validation.validation_errors))

        # Case 2: BPM <= 0
        corrupt_bpm = Track(
            filepath=self.file_a,
            filename="a.mp3",
            file_hash="h1",
            title="Corrupt BPM",
            artist="Test",
            duration=200.0,
            bpm=0.0,
            camelot_key="8A",
            scan_status="analyzed"
        )
        plan2 = planner.create_transition_plan(corrupt_bpm, self.track_2)
        self.assertFalse(plan2.validation.is_valid)
        self.assertTrue(any("bpm" in e.lower() for e in plan2.validation.validation_errors))

        # Case 3: Missing audio file on disk
        missing_file = Track(
            filepath="/non/existent/path/ghost_song.mp3",
            filename="ghost_song.mp3",
            file_hash="ghost",
            title="Ghost Song",
            artist="Ghost Artist",
            duration=200.0,
            bpm=124.0,
            camelot_key="8A",
            scan_status="analyzed"
        )
        plan3 = planner.create_transition_plan(missing_file, self.track_2)
        self.assertFalse(plan3.validation.is_valid)
        self.assertTrue(any("missing" in e.lower() for e in plan3.validation.validation_errors))

        # Case 4: Corrupted scan status
        error_track = Track(
            filepath=self.file_a,
            filename="a.mp3",
            file_hash="h1",
            title="Error Track",
            artist="Test",
            duration=200.0,
            bpm=124.0,
            camelot_key="8A",
            scan_status="error"
        )
        plan4 = planner.create_transition_plan(error_track, self.track_2)
        self.assertFalse(plan4.validation.is_valid)
        self.assertTrue(any("corrupted scan" in e.lower() for e in plan4.validation.validation_errors))

    def test_validation_rejection_extreme_tempo_difference(self):
        """Reject transitions with pitch shift > 8% unless using Echo Out or Loop style."""
        planner = PerformancePlanner()

        # Track with 145 BPM vs 124 BPM -> ~16.9% tempo jump
        fast_track = Track(
            filepath=self.file_c,
            filename="track_c.mp3",
            file_hash="hash_c",
            title="Fast Techno",
            artist="Beat Master",
            duration=300.0,
            bpm=145.0,
            camelot_key="8A",
            scan_status="analyzed"
        )

        # Forcing a smooth blend over 124 vs 145 BPM must be REJECTED by validator
        plan_smooth = planner.create_transition_plan(
            self.track_1, fast_track, preferred_style=TransitionStyle.SMOOTH_BLEND
        )
        self.assertFalse(plan_smooth.validation.is_valid)
        self.assertTrue(any("pitch shift" in e.lower() or "incompatible tempo" in e.lower()
                            for e in plan_smooth.validation.validation_errors))

        # However, planner auto-selects ECHO_OUT when BPM difference > 6.0
        plan_auto = planner.create_transition_plan(self.track_1, fast_track)
        self.assertEqual(plan_auto.transition_style, TransitionStyle.ECHO_OUT)
        # And Echo Out is permitted to bridge wide tempos
        self.assertTrue(plan_auto.validation.is_valid)

    def test_validation_rejection_incompatible_songs_melodic_personality(self):
        """Strict harmonic clash rejection for Melodic DJ (harmonic_strictness >= 2.0)."""
        melodic_dj = get_personality("melodic")
        planner = PerformancePlanner(personality=melodic_dj)

        # Incompatible key: 8A (A minor) vs 3A (B-flat minor) -> distance 5 on Camelot wheel
        dissonant_track = Track(
            filepath=self.file_c,
            filename="track_c.mp3",
            file_hash="hash_c",
            title="Dissonant Key",
            artist="Modulation",
            duration=300.0,
            bpm=124.0,
            camelot_key="3A",
            scan_status="analyzed"
        )

        plan = planner.create_transition_plan(self.track_1, dissonant_track)
        self.assertFalse(plan.validation.is_valid)
        self.assertTrue(any("strict harmonic rejection" in e.lower() for e in plan.validation.validation_errors))

        # But under Club DJ (harmonic_strictness = 1.0), it is tolerated with a warning and confidence drop
        club_planner = PerformancePlanner(personality=get_personality("club"))
        club_plan = club_planner.create_transition_plan(self.track_1, dissonant_track)
        self.assertTrue(club_plan.validation.is_valid)
        self.assertLess(club_plan.validation.confidence_score, 1.0)
        self.assertTrue(any("harmonic clash" in w.lower() for w in club_plan.validation.warnings))

    def test_validation_timing_overflow_prevention(self):
        """Ensure transition does not overrun the physical end of the outgoing track."""
        planner = PerformancePlanner()

        # Short track: 40 seconds duration, with a 64-beat extended mix (at 124 BPM = 31 seconds)
        short_track = Track(
            filepath=self.file_a,
            filename="short.mp3",
            file_hash="h_short",
            title="Short Edit",
            artist="Shorty",
            duration=40.0,
            bpm=124.0,
            camelot_key="8A",
            cue_in=5.0,
            cue_out=38.0,  # Outro cue right at 38s
            scan_status="analyzed"
        )

        plan = planner.create_transition_plan(
            short_track, self.track_2, preferred_style=TransitionStyle.EXTENDED_MIX
        )
        # 38s - 15.5s = 22.5s start; 22.5s + 31.0s = 53.5s > 40.0s duration!
        self.assertFalse(plan.validation.is_valid)
        self.assertTrue(any("overflow" in e.lower() for e in plan.validation.validation_errors))


if __name__ == "__main__":
    unittest.main()
