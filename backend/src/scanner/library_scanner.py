"""
MIXMIND - Local Music Library Scanner Service
Recursively scans local music folders, extracts tags and audio properties,
detects duplicate files, handles corrupt metadata gracefully, and updates SQLite.
Strictly local and read-only: never modifies or transmits source audio files.
"""

import os
import time
import hashlib
import logging
from typing import List, Optional, Set, Dict, Any

from ..database.db import DatabaseManager
from ..database.models import Track, ScanResult
from .metadata_extractor import MetadataExtractor, MetadataExtractionError

logger = logging.getLogger("LibraryScanner")

# Supported Audio File Extensions
SUPPORTED_EXTENSIONS: Set[str] = {
    ".mp3",
    ".wav",
    ".flac",
    ".m4a",
    ".aiff",
    ".aif",
}


def compute_file_hash(filepath: str, block_size: int = 65536) -> str:
    """
    Computes a cryptographic SHA-256 hash of file content.
    For files under 32MB: reads the entire file in 64KB blocks.
    For files >= 32MB: hashes header (1MB), middle (1MB), footer (1MB) + exact byte length.
    Strictly read-only.
    """
    try:
        size = os.path.getsize(filepath)
        hasher = hashlib.sha256()
        hasher.update(str(size).encode("utf-8"))

        with open(filepath, "rb") as f:
            if size < 32 * 1024 * 1024:
                while chunk := f.read(block_size):
                    hasher.update(chunk)
            else:
                # Large audio file sampling
                sample_size = 1024 * 1024  # 1MB
                hasher.update(f.read(sample_size))
                f.seek(size // 2)
                hasher.update(f.read(sample_size))
                f.seek(max(0, size - sample_size))
                hasher.update(f.read(sample_size))

        return hasher.hexdigest()
    except Exception as e:
        logger.warning(f"Failed to compute hash for {filepath}: {e}")
        return ""


class LibraryScanner:
    def __init__(self, db: DatabaseManager, extractor: Optional[MetadataExtractor] = None):
        self.db = db
        self.extractor = extractor or MetadataExtractor()

    def scan_folder(self, folder_path: str, force_reanalysis: bool = False) -> ScanResult:
        """
        Recursively scans the specified folder.
        - Identifies supported formats and ignores unsupported files.
        - Computes file hashes to detect duplicate files.
        - Uses mtime/size caching to avoid redundant re-analysis on rescans.
        - Handles corrupt/unreadable metadata gracefully without crashing.
        - Preserves source files with strict read-only access.
        """
        abs_folder = os.path.abspath(os.path.expanduser(folder_path))
        start_time = time.time()
        result = ScanResult(folder_path=abs_folder)

        if not os.path.isdir(abs_folder):
            err_msg = f"Directory not found: {abs_folder}"
            logger.error(err_msg)
            result.errors.append({"filepath": abs_folder, "error": err_msg})
            result.errors_count = 1
            result.duration_seconds = round(time.time() - start_time, 3)
            return result

        logger.info(f"Starting recursive music library scan at: {abs_folder}")

        # 1. Discover all files
        discovered_audio_files: List[str] = []

        for root, _, files in os.walk(abs_folder):
            # Ignore hidden directories and macOS metadata folders
            if "/." in root or "\\." in root or "__MACOSX" in root:
                continue

            for file in files:
                # Ignore hidden files like .DS_Store
                if file.startswith("."):
                    result.unsupported_ignored += 1
                    continue

                result.total_files_found += 1
                abs_path = os.path.abspath(os.path.join(root, file))
                ext = os.path.splitext(file)[1].lower()

                if ext in SUPPORTED_EXTENSIONS:
                    result.supported_files += 1
                    discovered_audio_files.append(abs_path)
                else:
                    result.unsupported_ignored += 1

        logger.info(f"Discovered {len(discovered_audio_files)} supported audio files ({result.unsupported_ignored} unsupported files ignored).")

        # 2. Process each audio file
        for filepath in discovered_audio_files:
            try:
                self._process_file(filepath, result, force_reanalysis)
            except Exception as e:
                logger.error(f"Unexpected error processing {filepath}: {e}")
                result.errors_count += 1
                result.errors.append({"filepath": filepath, "error": str(e)})

        result.duration_seconds = round(time.time() - start_time, 3)
        logger.info(
            f"Scan completed in {result.duration_seconds}s. "
            f"Added: {result.added}, Updated: {result.updated}, Skipped Unchanged: {result.skipped_unchanged}, "
            f"Duplicates: {result.duplicates_detected}, Errors: {result.errors_count}"
        )
        return result

    def _process_file(self, filepath: str, result: ScanResult, force_reanalysis: bool):
        filename = os.path.basename(filepath)
        ext = os.path.splitext(filename)[1].lower().lstrip(".")

        try:
            stat = os.stat(filepath)
            file_size = stat.st_size
            file_mtime = stat.st_mtime
        except Exception as e:
            result.errors_count += 1
            result.errors.append({"filepath": filepath, "error": f"Cannot stat file: {e}"})
            return

        # Check existing record in DB for rescan caching
        existing = self.db.get_track_by_path(filepath)

        if not force_reanalysis and existing:
            # Check if file has not been modified since last scan
            is_mtime_same = abs(existing.file_mtime - file_mtime) < 0.001
            is_size_same = (existing.file_size == file_size)

            if is_mtime_same and is_size_same and existing.scan_status == "scanned":
                result.skipped_unchanged += 1
                return

        # Compute content hash
        file_hash = compute_file_hash(filepath)

        # Check duplicate detection
        is_duplicate = 0
        duplicate_of_id: Optional[int] = None

        if file_hash:
            matches = self.db.get_tracks_by_hash(file_hash)
            # Find if there is an existing primary track with a different filepath
            other_matches = [m for m in matches if m.filepath != filepath]
            if other_matches:
                is_duplicate = 1
                duplicate_of_id = other_matches[0].id
                result.duplicates_detected += 1

        # Extract metadata
        scan_status = "scanned"
        scan_error = ""
        meta = {
            "title": "",
            "artist": "Unknown Artist",
            "album": "Unknown Album",
            "genre": "Unknown Genre",
            "year": None,
            "duration": 0.0,
            "sample_rate": 44100,
            "bitrate": 0,
            "channels": 2,
            "file_format": ext,
        }

        try:
            meta = self.extractor.extract(filepath)
        except MetadataExtractionError as e:
            scan_status = "error"
            scan_error = str(e)
            result.errors_count += 1
            result.errors.append({"filepath": filepath, "error": scan_error})
            logger.warning(f"Corrupt or unreadable metadata for {filename}: {scan_error}")
            # Filename heuristic fallback
            clean_title, clean_artist = MetadataExtractor._clean_filename_heuristics(filename)
            meta["title"] = clean_title
            meta["artist"] = clean_artist

        track = Track(
            filepath=filepath,
            filename=filename,
            file_hash=file_hash,
            file_size=file_size,
            file_mtime=file_mtime,
            file_format=ext,
            title=meta.get("title") or filename,
            artist=meta.get("artist") or "Unknown Artist",
            album=meta.get("album") or "Unknown Album",
            genre=meta.get("genre") or "Unknown Genre",
            year=meta.get("year"),
            duration=meta.get("duration", 0.0),
            sample_rate=meta.get("sample_rate", 44100),
            bitrate=meta.get("bitrate", 0),
            channels=meta.get("channels", 2),
            is_duplicate=is_duplicate,
            duplicate_of_id=duplicate_of_id,
            scan_status=scan_status,
            scan_error=scan_error,
        )

        self.db.upsert_track(track)

        if existing:
            result.updated += 1
        else:
            result.added += 1
