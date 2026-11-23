"""
MIXMIND - Audio Metadata Extractor
Extracts tags, duration, and technical audio attributes across MP3, WAV, FLAC, M4A, and AIFF.
Strictly read-only: never modifies source files.
"""

import os
import re
import logging
from typing import Dict, Any, Optional

import mutagen
from mutagen.mp3 import MP3
from mutagen.flac import FLAC
from mutagen.mp4 import MP4
from mutagen.wave import WAVE
from mutagen.aiff import AIFF

logger = logging.getLogger("MetadataExtractor")


class MetadataExtractionError(Exception):
    """Raised when an audio file cannot be decoded or parsed."""
    pass


class MetadataExtractor:
    def extract(self, filepath: str) -> Dict[str, Any]:
        """
        Reads metadata from an audio file.
        Returns a dictionary with title, artist, album, genre, year, duration,
        sample_rate, bitrate, and channels.
        """
        if not os.path.exists(filepath):
            raise MetadataExtractionError(f"File not found: {filepath}")

        if os.path.getsize(filepath) == 0:
            raise MetadataExtractionError(f"Zero-byte empty file: {filepath}")

        filename = os.path.basename(filepath)
        ext = os.path.splitext(filename)[1].lower()

        data = {
            "title": "",
            "artist": "",
            "album": "Unknown Album",
            "genre": "Unknown Genre",
            "year": None,
            "duration": 0.0,
            "sample_rate": 44100,
            "bitrate": 0,
            "channels": 2,
            "file_format": ext.lstrip("."),
        }

        # 1. Mutagen audio loading (strictly read-only)
        try:
            audio = mutagen.File(filepath, easy=False)
            if audio is None:
                raise MetadataExtractionError(f"Mutagen could not recognize format: {filename}")

            # Audio stream info
            if hasattr(audio, "info") and audio.info:
                data["duration"] = round(float(getattr(audio.info, "length", 0.0)), 2)
                data["sample_rate"] = int(getattr(audio.info, "sample_rate", 44100))
                data["bitrate"] = int(getattr(audio.info, "bitrate", 0))
                data["channels"] = int(getattr(audio.info, "channels", 2))

            # Tag parsing by format
            if hasattr(audio, "tags") and audio.tags:
                tag_dict = self._parse_tags(audio.tags, ext)
                for k, v in tag_dict.items():
                    if v:
                        data[k] = v

        except Exception as e:
            if isinstance(e, MetadataExtractionError):
                raise
            raise MetadataExtractionError(f"Audio read failure on {filename}: {e}") from e

        # 2. Filename heuristic fallbacks if metadata is missing
        clean_title, clean_artist = self._clean_filename_heuristics(filename)
        if not data["title"]:
            data["title"] = clean_title
        if not data["artist"]:
            data["artist"] = clean_artist

        return data

    def _parse_tags(self, tags, ext: str) -> Dict[str, Any]:
        result = {}

        # 1. Title
        for key in ("TIT2", "\xa9nam", "title", "TITLE", "INAM"):
            if key in tags:
                val = self._sanitize_tag_value(tags[key])
                if val:
                    result["title"] = val
                    break

        # 2. Artist
        for key in ("TPE1", "\xa9ART", "artist", "ARTIST", "IART"):
            if key in tags:
                val = self._sanitize_tag_value(tags[key])
                if val:
                    result["artist"] = val
                    break

        # 3. Album
        for key in ("TALB", "\xa9alb", "album", "ALBUM", "IPRD"):
            if key in tags:
                val = self._sanitize_tag_value(tags[key])
                if val:
                    result["album"] = val
                    break

        # 4. Genre
        for key in ("TCON", "\xa9gen", "genre", "GENRE", "IGNR"):
            if key in tags:
                val = self._sanitize_tag_value(tags[key])
                if val:
                    result["genre"] = val
                    break

        # 5. Year / Date
        for key in ("TDRC", "\xa9day", "date", "DATE", "year", "YEAR", "TYER"):
            if key in tags:
                val = self._sanitize_tag_value(tags[key])
                m = re.search(r"\b(19\d\d|20\d\d)\b", val)
                if m:
                    result["year"] = int(m.group(1))
                    break

        return result

    @staticmethod
    def _sanitize_tag_value(raw: Any) -> str:
        if isinstance(raw, (list, tuple)):
            raw = raw[0] if raw else ""
        return str(raw).strip()

    @staticmethod
    def _clean_filename_heuristics(filename: str) -> tuple:
        """Strips track numbers and checks for 'Artist - Title' format in filename."""
        name_no_ext = os.path.splitext(filename)[0].strip()

        # Strip track number prefixes like "01 - ", "1. ", "02. ", "[01] "
        cleaned = re.sub(r"^(?:\[?\d{1,3}\]?[\s.\-_]+)+", "", name_no_ext).strip()

        artist = "Unknown Artist"
        title = cleaned or name_no_ext

        if " - " in cleaned:
            parts = cleaned.split(" - ", 1)
            if parts[0].strip() and parts[1].strip():
                artist = parts[0].strip()
                title = parts[1].strip()

        return title, artist
