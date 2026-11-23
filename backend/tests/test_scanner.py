"""
MIXMIND - Local Music Library Scanner Unit Tests
Verifies recursive scanning, format filtering, metadata extraction, duplicate detection,
rescan idempotency, mtime change tracking, error handling, and source file preservation.
"""

import os
import sys
import unittest
import tempfile
import shutil
import hashlib
import time
import soundfile as sf
import numpy as np

# Ensure backend modules are on path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.src.database.db import DatabaseManager
from backend.src.scanner.library_scanner import LibraryScanner, compute_file_hash, SUPPORTED_EXTENSIONS
from backend.src.scanner.metadata_extractor import MetadataExtractor, MetadataExtractionError


def create_pcm_audio_file(filepath: str, duration_sec: float = 1.0, sr: int = 44100, fmt: str = "WAV"):
    """Generates a valid audio file with synthetic sine wave."""
    t = np.linspace(0, duration_sec, int(sr * duration_sec))
    audio_data = (0.5 * np.sin(2 * np.pi * 440 * t)).astype(np.float32)
    sf.write(filepath, audio_data, sr, format=fmt)


class TestLibraryScanner(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="mixmind_test_library_")
        self.db_path = os.path.join(self.temp_dir, "test_mixmind.db")
        self.db = DatabaseManager(self.db_path)
        self.scanner = LibraryScanner(db=self.db)

        # Create nested test folder structure
        self.music_dir = os.path.join(self.temp_dir, "music")
        self.sub_dir = os.path.join(self.music_dir, "Deep House", "2026")
        os.makedirs(self.sub_dir, exist_ok=True)

    def tearDown(self):
        shutil.rmtree(self.temp_dir)

    def test_supported_and_unsupported_formats(self):
        """Tests that MP3, WAV, FLAC, AIFF are detected while TXT, JPG, DS_Store are ignored."""
        # 1. Create valid audio files
        wav_path = os.path.join(self.music_dir, "track1.wav")
        flac_path = os.path.join(self.sub_dir, "track2.flac")
        aiff_path = os.path.join(self.sub_dir, "track3.aiff")
        create_pcm_audio_file(wav_path, duration_sec=1.5, fmt="WAV")
        create_pcm_audio_file(flac_path, duration_sec=2.0, fmt="FLAC")
        create_pcm_audio_file(aiff_path, duration_sec=1.0, fmt="AIFF")

        # 2. Create unsupported files & hidden files
        txt_path = os.path.join(self.music_dir, "album_notes.txt")
        jpg_path = os.path.join(self.sub_dir, "cover.jpg")
        ds_store = os.path.join(self.sub_dir, ".DS_Store")
        with open(txt_path, "w") as f:
            f.write("Album tracklist details")
        with open(jpg_path, "wb") as f:
            f.write(b"\xff\xd8\xff\xe0" + b"\x00" * 50)
        with open(ds_store, "wb") as f:
            f.write(b"macos_ds_store_bytes")

        # Run scan
        result = self.scanner.scan_folder(self.music_dir)

        # Verify scan metrics
        self.assertEqual(result.supported_files, 3)
        self.assertEqual(result.unsupported_ignored, 3)  # txt, jpg, .DS_Store
        self.assertEqual(result.added, 3)

        # Verify database contents
        all_tracks = self.db.get_all_tracks()
        self.assertEqual(len(all_tracks), 3)

        formats = {t.file_format for t in all_tracks}
        self.assertEqual(formats, {"wav", "flac", "aiff"})

    def test_original_file_preservation_read_only(self):
        """Verifies that original music files are never modified (hashes, size, mtime unchanged)."""
        test_file = os.path.join(self.music_dir, "pristine.wav")
        create_pcm_audio_file(test_file, duration_sec=1.2)

        # Capture initial state
        initial_stat = os.stat(test_file)
        initial_hash = compute_file_hash(test_file)

        # Run scan
        result = self.scanner.scan_folder(self.music_dir)
        self.assertEqual(result.added, 1)

        # Capture post-scan state
        post_stat = os.stat(test_file)
        post_hash = compute_file_hash(test_file)

        self.assertEqual(initial_stat.st_mtime, post_stat.st_mtime, "File mtime was altered!")
        self.assertEqual(initial_stat.st_size, post_stat.st_size, "File size was altered!")
        self.assertEqual(initial_hash, post_hash, "File content hash was altered!")

    def test_rescan_idempotency_no_duplicates(self):
        """Verifies that scanning the folder a second time does not create duplicate DB rows."""
        create_pcm_audio_file(os.path.join(self.music_dir, "song1.wav"), duration_sec=1.0)
        create_pcm_audio_file(os.path.join(self.music_dir, "song2.flac"), duration_sec=1.5, fmt="FLAC")

        # First scan
        res1 = self.scanner.scan_folder(self.music_dir)
        self.assertEqual(res1.added, 2)
        self.assertEqual(res1.skipped_unchanged, 0)
        self.assertEqual(len(self.db.get_all_tracks()), 2)

        # Second scan (identical folder)
        res2 = self.scanner.scan_folder(self.music_dir)
        self.assertEqual(res2.added, 0)
        self.assertEqual(res2.skipped_unchanged, 2)
        # Database count must still be exactly 2
        self.assertEqual(len(self.db.get_all_tracks()), 2)

    def test_duplicate_file_detection(self):
        """Verifies that identical audio files in different paths are detected as duplicates."""
        file_a = os.path.join(self.music_dir, "original.wav")
        file_b = os.path.join(self.sub_dir, "copy_of_original.wav")

        create_pcm_audio_file(file_a, duration_sec=2.0)
        # Copy exact identical file to another folder
        shutil.copy2(file_a, file_b)

        result = self.scanner.scan_folder(self.music_dir)
        self.assertEqual(result.supported_files, 2)
        self.assertEqual(result.added, 2)
        self.assertEqual(result.duplicates_detected, 1)

        track_a = self.db.get_track_by_path(file_a)
        track_b = self.db.get_track_by_path(file_b)

        self.assertIsNotNone(track_a)
        self.assertIsNotNone(track_b)
        self.assertEqual(track_a.file_hash, track_b.file_hash)

        # Exactly one must be marked as duplicate
        duplicates = self.db.get_duplicate_tracks()
        self.assertEqual(len(duplicates), 1)
        self.assertEqual(duplicates[0].is_duplicate, 1)
        self.assertIsNotNone(duplicates[0].duplicate_of_id)

    def test_mtime_change_reanalysis(self):
        """Verifies that modifying a file's mtime/content causes it to be updated, not skipped."""
        target_file = os.path.join(self.music_dir, "dynamic.wav")
        create_pcm_audio_file(target_file, duration_sec=1.0)

        # 1. Initial scan
        res1 = self.scanner.scan_folder(self.music_dir)
        self.assertEqual(res1.added, 1)
        t_initial = self.db.get_track_by_path(target_file)
        self.assertAlmostEqual(t_initial.duration, 1.0, places=1)

        # 2. Modify the file (make it 2.5s)
        time.sleep(0.05)  # Ensure distinct timestamp
        create_pcm_audio_file(target_file, duration_sec=2.5)

        # 3. Rescan
        res2 = self.scanner.scan_folder(self.music_dir)
        self.assertEqual(res2.added, 0)
        self.assertEqual(res2.updated, 1)
        self.assertEqual(res2.skipped_unchanged, 0)

        t_updated = self.db.get_track_by_path(target_file)
        self.assertAlmostEqual(t_updated.duration, 2.5, places=1)

    def test_corrupted_file_handling(self):
        """Verifies that corrupted/invalid audio files are logged without crashing the scan."""
        good_file = os.path.join(self.music_dir, "valid.wav")
        corrupt_file = os.path.join(self.music_dir, "corrupted.mp3")
        zero_byte_file = os.path.join(self.music_dir, "empty.flac")

        create_pcm_audio_file(good_file, duration_sec=1.0)

        # Corrupt file: invalid junk bytes
        with open(corrupt_file, "wb") as f:
            f.write(b"NOT_A_REAL_MP3_DATA_GARBAGE_BYTES" * 100)

        # Zero-byte file
        with open(zero_byte_file, "wb") as f:
            pass

        result = self.scanner.scan_folder(self.music_dir)

        # Should scan the valid file + record the 2 errors without crashing
        self.assertEqual(result.supported_files, 3)
        self.assertEqual(result.errors_count, 2)
        self.assertEqual(len(result.errors), 2)

        # Good file must still be successfully indexed
        t_good = self.db.get_track_by_path(good_file)
        self.assertIsNotNone(t_good)
        self.assertEqual(t_good.scan_status, "scanned")

        # Corrupt file is recorded with error status
        t_corrupt = self.db.get_track_by_path(corrupt_file)
        self.assertIsNotNone(t_corrupt)
        self.assertEqual(t_corrupt.scan_status, "error")

    def test_missing_metadata_heuristic_fallback(self):
        """Verifies smart filename parsing when audio tags are missing."""
        # Filename with track number and Artist - Title
        filename = "03 - CamelPhat - Breathe.wav"
        filepath = os.path.join(self.music_dir, filename)
        create_pcm_audio_file(filepath, duration_sec=1.0)

        result = self.scanner.scan_folder(self.music_dir)
        self.assertEqual(result.added, 1)

        track = self.db.get_track_by_path(filepath)
        self.assertIsNotNone(track)
        self.assertEqual(track.artist, "CamelPhat")
        self.assertEqual(track.title, "Breathe")
        self.assertEqual(track.album, "Unknown Album")
        self.assertEqual(track.genre, "Unknown Genre")


if __name__ == "__main__":
    unittest.main()
