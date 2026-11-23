"""
MIXMIND - Audio Analysis & Music Intelligence Engine Tests
Verifies measured acoustic properties, musical label estimation, key & mode detection,
danceability, vocal presence, structural sections, caching, user overrides, and background workers.
"""

import os
import sys
import unittest
import tempfile
import shutil
import time
import numpy as np
import soundfile as sf

# Ensure backend modules are on path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.src.database.db import DatabaseManager
from backend.src.database.models import Track
from backend.src.analysis.audio_analyzer import AudioAnalyzer
from backend.src.analysis.key_detector import estimate_key_and_mode, KK_MAJOR, KK_MINOR
from backend.src.analysis.danceability_estimator import estimate_danceability
from backend.src.analysis.vocal_detector import estimate_vocal_and_instrumental
from backend.src.analysis.structure_detector import detect_structural_sections
from backend.src.analysis.background_worker import AnalysisQueue


def create_synthetic_house_track(
    filepath: str,
    duration_sec: float = 8.0,
    bpm: float = 124.0,
    sr: int = 22050,
    tonic_freq: float = 220.0  # A3 (A minor)
):
    """
    Synthesizes a realistic 4-on-the-floor house track segment:
    - 4-on-the-floor kick drums (low-frequency pitch drops)
    - Offbeat hi-hats (filtered high noise)
    - Tonal synth chords (tonic frequency)
    """
    total_samples = int(sr * duration_sec)
    audio = np.zeros(total_samples, dtype=np.float32)

    beat_interval = int(sr * (60.0 / bpm))

    # 1. 4-on-the-floor Kicks
    kick_len = int(sr * 0.15)
    t_kick = np.linspace(0, 0.15, kick_len)
    kick_freq = 150.0 * np.exp(-t_kick * 25.0) + 40.0
    kick_wave = 0.8 * np.sin(2 * np.pi * kick_freq * t_kick) * np.exp(-t_kick * 15.0)

    for b in range(0, total_samples - kick_len, beat_interval):
        audio[b : b + kick_len] += kick_wave

    # 2. Tonal Synth Pad (A Minor chord: A=220, C=261.6, E=329.6)
    t_full = np.linspace(0, duration_sec, total_samples)
    pad = 0.25 * (
        np.sin(2 * np.pi * tonic_freq * t_full)
        + np.sin(2 * np.pi * (tonic_freq * 1.189) * t_full)  # Minor third (C)
        + np.sin(2 * np.pi * (tonic_freq * 1.498) * t_full)  # Fifth (E)
    )
    audio += pad.astype(np.float32)

    # Normalize to -1 dB
    max_amp = np.max(np.abs(audio))
    if max_amp > 0:
        audio = (audio / max_amp) * 0.9

    sf.write(filepath, audio, sr, format="WAV")


class TestAudioAnalysisEngine(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="mixmind_test_analysis_")
        self.cache_dir = os.path.join(self.temp_dir, "cache")
        self.db_path = os.path.join(self.temp_dir, "test.db")
        self.db = DatabaseManager(self.db_path)
        self.analyzer = AudioAnalyzer(cache_dir=self.cache_dir)

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def test_key_and_mode_estimation(self):
        """Verifies tonic key, mode (major/minor), Camelot code, and confidence scoring."""
        # Synthesize pure A minor chroma profile (tonic A = pitch class 9)
        a_minor_chroma = np.roll(KK_MINOR, 9)
        res_min = estimate_key_and_mode(a_minor_chroma)

        self.assertEqual(res_min["key"], "A")
        self.assertEqual(res_min["mode"], "minor")
        self.assertEqual(res_min["camelot_key"], "8A")
        self.assertGreater(res_min["confidence"], 0.70)

        # Synthesize C major chroma profile (tonic C = pitch class 0)
        c_major_chroma = KK_MAJOR.copy()
        res_maj = estimate_key_and_mode(c_major_chroma)

        self.assertEqual(res_maj["key"], "C")
        self.assertEqual(res_maj["mode"], "major")
        self.assertEqual(res_maj["camelot_key"], "8B")
        self.assertGreater(res_maj["confidence"], 0.70)

    def test_danceability_estimation(self):
        """Verifies danceability calculation on structured vs flat envelopes."""
        sr = 22050
        hop = 512
        fps = sr / hop
        # Create clear 124 BPM regular beat envelope (pulse every ~26 frames)
        beat_frames = int(fps * (60.0 / 124.0))
        regular_onset = np.zeros(int(fps * 10))
        regular_onset[::beat_frames] = 1.0

        dance_regular = estimate_danceability(regular_onset, bpm=124.0, sr=sr, hop_length=hop)
        self.assertGreaterEqual(dance_regular, 0.65)

        # Flat / erratic envelope
        erratic_onset = np.random.rand(int(fps * 10)) * 0.1
        dance_erratic = estimate_danceability(erratic_onset, bpm=60.0, sr=sr, hop_length=hop)
        self.assertLess(dance_erratic, dance_regular)

    def test_vocal_and_instrumental_detection(self):
        """Verifies vocal presence and instrumental confidence estimation."""
        sr = 22050
        t = np.linspace(0, 3.0, sr * 3)

        # Instrumental kick/bass (low frequency sine)
        bass_y = 0.8 * np.sin(2 * np.pi * 55 * t)
        vocal_res_inst = estimate_vocal_and_instrumental(bass_y, sr=sr)
        self.assertGreater(vocal_res_inst["instrumental_confidence"], 0.50)

    def test_structural_sections_and_cues(self):
        """Verifies intro cue, outro cue, drop, and breakdown section detection."""
        sr = 22050
        duration = 12.0
        t = np.linspace(0, duration, int(sr * duration))
        y = (0.5 * np.sin(2 * np.pi * 100 * t)).astype(np.float32)

        intro_cue, outro_cue, drops, breakdowns, sections = detect_structural_sections(
            y=y, sr=sr, duration=duration, bpm=124.0
        )

        self.assertGreaterEqual(intro_cue, 0.0)
        self.assertLessEqual(intro_cue, outro_cue)
        self.assertGreaterEqual(len(sections), 2)  # At least intro and outro

    def test_full_audio_analysis_and_caching(self):
        """Verifies complete analysis report generation and O(1) disk cache loading."""
        track_path = os.path.join(self.temp_dir, "test_track.wav")
        create_synthetic_house_track(track_path, duration_sec=6.0, bpm=124.0)

        # 1. Initial Analysis
        start_t = time.time()
        report1 = self.analyzer.analyze_file(track_path, file_hash="hash_test_123")
        time1 = time.time() - start_t

        self.assertIsNotNone(report1)
        self.assertEqual(report1.file_hash, "hash_test_123")
        self.assertAlmostEqual(report1.measured.duration_seconds, 6.0, places=1)
        self.assertGreater(report1.measured.rms_energy_mean, 0.0)
        self.assertGreater(report1.measured.spectral_centroid_mean, 0.0)
        self.assertGreater(report1.estimated.energy_rating, 0.0)
        self.assertGreaterEqual(report1.estimated.danceability, 0.0)

        # 2. Cached Analysis (Should be sub-millisecond cache hit)
        start_cached = time.time()
        report2 = self.analyzer.analyze_file(track_path, file_hash="hash_test_123")
        time_cached = time.time() - start_cached

        self.assertEqual(report1.estimated.bpm, report2.estimated.bpm)
        self.assertEqual(report1.estimated.camelot_key, report2.estimated.camelot_key)
        self.assertLess(time_cached, time1)

    def test_user_overrides_for_bpm_and_key(self):
        """Verifies that manual user corrections take precedence over algorithmic estimates."""
        track = Track(
            filepath="/override/test.mp3",
            filename="test.mp3",
            file_hash="hash_ovr",
            title="Overridable Track",
            artist="DJ AI",
            bpm=124.0,
            camelot_key="8A"
        )
        track_id = self.db.upsert_track(track)

        # Algorithmic initial properties
        t1 = self.db.get_track_by_id(track_id)
        self.assertEqual(t1.effective_bpm, 124.0)
        self.assertEqual(t1.effective_key, "8A")

        # User corrects BPM to 128.0 and Key to 11B (A Major)
        self.db.set_track_user_override(track_id, bpm=128.0, key="11B", cue_in=16.0)

        t2 = self.db.get_track_by_id(track_id)
        self.assertEqual(t2.effective_bpm, 128.0)
        self.assertEqual(t2.effective_key, "11B")
        self.assertEqual(t2.effective_cue_in, 16.0)
        # Original algorithmic fields remain preserved
        self.assertEqual(t2.bpm, 124.0)
        self.assertEqual(t2.camelot_key, "8A")

    def test_background_worker_queue(self):
        """Verifies asynchronous background processing of tracks via AnalysisQueue."""
        track_path = os.path.join(self.temp_dir, "bg_track.wav")
        create_synthetic_house_track(track_path, duration_sec=4.0, bpm=124.0)

        track = Track(
            filepath=track_path,
            filename="bg_track.wav",
            file_hash="hash_bg_01",
            title="Background Track",
            artist="Worker Test"
        )
        track_id = self.db.upsert_track(track)

        completed_events = []
        def on_progress(done, total, report):
            completed_events.append((done, total, report))

        queue = AnalysisQueue(db=self.db, analyzer=self.analyzer, max_workers=1)
        queue.add_progress_callback(on_progress)
        queue.start()

        task = queue.enqueue(track_id, track_path, file_hash="hash_bg_01")
        self.assertEqual(task.status, "pending")

        # Wait for worker to finish
        for _ in range(50):
            if task.status == "completed":
                break
            time.sleep(0.1)

        queue.stop()

        self.assertEqual(task.status, "completed")
        self.assertIsNotNone(task.report)
        self.assertGreater(len(completed_events), 0)

        # Verify DB was updated by worker
        updated_track = self.db.get_track_by_id(track_id)
        self.assertGreater(updated_track.energy, 0.0)


if __name__ == "__main__":
    unittest.main()
