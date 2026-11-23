"""
MIXMIND - Tests for DJ Tutorial Ingestion & Telemetry Learning Engine
Verifies semantic rule parsing, DSP sub-band frequency curves, video telemetry, and schema output.
"""

import os
import unittest
import numpy as np

from backend.src.analysis.tutorial_ingestor import (
    AudioSpeechAnalyzer,
    TransitionDSPAnalyzer,
    VideoTelemetryExtractor,
    DJTutorialIngestionEngine,
    TutorialTransitionSchema
)


class TestTutorialIngestionEngine(unittest.TestCase):
    def setUp(self):
        self.sr = 22050
        self.duration = 20.0
        # Generate synthetic test signal: 128 BPM pulse + 1000 Hz tone + 440 Hz tone
        t = np.linspace(0, self.duration, int(self.sr * self.duration), endpoint=False)
        # 128 BPM = ~2.133 beats/sec -> period 0.46875s
        beat_pulse = np.zeros_like(t)
        hop = int(self.sr * (60.0 / 128.0))
        for idx in range(0, len(t), hop):
            beat_pulse[idx:min(len(t), idx + 200)] = 0.8

        self.synth_audio = beat_pulse + 0.1 * np.sin(2 * np.pi * 1000 * t) + 0.05 * np.sin(2 * np.pi * 80 * t)

    def test_audio_and_speech_semantic_extraction(self):
        analyzer = AudioSpeechAnalyzer(sample_rate=self.sr)
        transcript = "Make sure you launch deck B on beat 1. Build the riser, swap the bass on drop, and keep vocal clear."
        res = analyzer.analyze_audio_and_speech(self.synth_audio, speech_transcript=transcript)

        self.assertIn("bpm", res)
        self.assertIn("phrase_lengths", res)
        self.assertIn("trigger_rules", res)
        self.assertGreater(len(res["trigger_rules"]), 0)

        # Check that conditional rules contain beat 1 launch and bass swap
        actions = [r.target_action for r in res["trigger_rules"]]
        self.assertIn("press_play", actions)
        self.assertIn("instant_bass_swap", actions)

    def test_dsp_reverse_engineering_and_archetype(self):
        dsp = TransitionDSPAnalyzer(sample_rate=self.sr)
        eq_curves, filter_fx, beats, dur_sec, archetype = dsp.reverse_engineer_transition(
            self.synth_audio, bpm=128.0, start_time_sec=2.0, end_time_sec=17.0
        )

        self.assertIn(beats, [16, 32, 48, 64])
        self.assertGreater(dur_sec, 0.0)
        self.assertIn(eq_curves.low_strategy, ["instant_downbeat_swap", "frequency_split"])
        self.assertEqual(len(eq_curves.outgoing_low_trajectory), 32)
        self.assertEqual(len(eq_curves.incoming_low_trajectory), 32)
        self.assertIn(filter_fx.primary_effect, ["filter_hpf_riser", "none"])

    def test_video_hardware_telemetry_clock_angles(self):
        video_tracker = VideoTelemetryExtractor("simulated_video.mp4")
        timeline = video_tracker.extract_hardware_telemetry(
            start_sec=10.0, duration_sec=15.0, duration_beats=32
        )

        self.assertGreater(len(timeline), 0)
        first_frame = timeline[0]
        last_frame = timeline[-1]

        # Initial state: Deck A fader high, Deck B fader low, Deck B low cut at 7:00
        self.assertEqual(first_frame.deck_a_channel_fader, 1.0)
        self.assertEqual(first_frame.deck_b_channel_fader, 0.0)
        self.assertEqual(first_frame.deck_b_low_knob_clock, "7:00")

        # Final state: Deck A fader low, Deck B fader high, Deck B low at 12:00
        self.assertEqual(last_frame.deck_a_channel_fader, 0.0)
        self.assertEqual(last_frame.deck_b_channel_fader, 1.0)
        self.assertEqual(last_frame.deck_b_low_knob_clock, "12:00")

    def test_schema_serialization_to_json(self):
        analyzer = AudioSpeechAnalyzer(sample_rate=self.sr)
        dsp = TransitionDSPAnalyzer(sample_rate=self.sr)
        video_tracker = VideoTelemetryExtractor("test.mp4")

        speech = analyzer.analyze_audio_and_speech(self.synth_audio)
        eq_curves, filter_fx, beats, dur_sec, arch = dsp.reverse_engineer_transition(
            self.synth_audio, bpm=128.0, start_time_sec=0.0, end_time_sec=15.0
        )
        hardware = video_tracker.extract_hardware_telemetry(0.0, dur_sec, beats)

        schema = TutorialTransitionSchema(
            tutorial_title="Test Tutorial",
            instructor_name="Test Instructor",
            detected_archetype=arch,
            master_bpm=128.0,
            transition_duration_beats=beats,
            transition_duration_seconds=dur_sec,
            deck_a_key="8A",
            deck_b_key="8A",
            cue_rules=[],
            trigger_rules=speech["trigger_rules"],
            eq_curves=eq_curves,
            filter_fx=filter_fx,
            hardware_telemetry_timeline=hardware,
            extracted_rules_summary=["Rule 1: Downbeat swap"]
        )

        json_str = schema.to_json()
        self.assertIn("Test Tutorial", json_str)
        self.assertIn("instant_bass_swap", json_str)
        self.assertIn("hardware_telemetry_timeline", json_str)


if __name__ == "__main__":
    unittest.main()
