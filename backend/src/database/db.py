"""
MIXMIND - SQLite Database Connection & CRUD Operations
"""

import sqlite3
import os
import time
import logging
from typing import Optional, List, Dict, Any

from .models import Track, CuePoint, MixRecord

logger = logging.getLogger("MixmindDB")

DEFAULT_DB_PATH = os.path.expanduser("~/Desktop/MIXMIND/data/library/mixmind.db")


class DatabaseManager:
    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        return conn

    def _init_db(self):
        """Initializes tables, indexes, and runs migrations."""
        with self._get_connection() as conn:
            cursor = conn.cursor()

            # Tracks Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS tracks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    filepath TEXT UNIQUE NOT NULL,
                    filename TEXT NOT NULL,
                    file_hash TEXT,
                    file_size INTEGER DEFAULT 0,
                    file_mtime REAL DEFAULT 0.0,
                    file_format TEXT DEFAULT '',
                    title TEXT,
                    artist TEXT,
                    album TEXT DEFAULT 'Unknown Album',
                    genre TEXT DEFAULT 'Unknown Genre',
                    year INTEGER,
                    duration REAL DEFAULT 0.0,
                    bpm REAL DEFAULT 124.0,
                    initial_key TEXT,
                    camelot_key TEXT DEFAULT '8A',
                    energy REAL DEFAULT 0.5,
                    danceability REAL DEFAULT 0.5,
                    vocal_presence REAL DEFAULT 0.5,
                    loudness REAL DEFAULT 0.0,
                    sample_rate INTEGER DEFAULT 44100,
                    bitrate INTEGER DEFAULT 0,
                    channels INTEGER DEFAULT 2,
                    cue_in REAL DEFAULT 0.0,
                    cue_out REAL DEFAULT 0.0,
                    phrase_length INTEGER DEFAULT 32,
                    is_duplicate INTEGER DEFAULT 0,
                    duplicate_of_id INTEGER,
                    scan_status TEXT DEFAULT 'scanned',
                    scan_error TEXT DEFAULT '',
                    user_bpm_override REAL,
                    user_key_override TEXT,
                    user_cue_in_override REAL,
                    user_cue_out_override REAL,
                    play_count INTEGER DEFAULT 0,
                    last_played_at REAL DEFAULT 0.0,
                    created_at REAL,
                    updated_at REAL
                )
            """)

            # Automated Column Migrations
            cursor.execute("PRAGMA table_info(tracks)")
            existing_cols = {row["name"] for row in cursor.fetchall()}

            new_columns = [
                ("file_size", "INTEGER DEFAULT 0"),
                ("file_mtime", "REAL DEFAULT 0.0"),
                ("file_format", "TEXT DEFAULT ''"),
                ("sample_rate", "INTEGER DEFAULT 44100"),
                ("bitrate", "INTEGER DEFAULT 0"),
                ("channels", "INTEGER DEFAULT 2"),
                ("is_duplicate", "INTEGER DEFAULT 0"),
                ("duplicate_of_id", "INTEGER"),
                ("scan_status", "TEXT DEFAULT 'scanned'"),
                ("scan_error", "TEXT DEFAULT ''"),
                ("user_bpm_override", "REAL"),
                ("user_key_override", "TEXT"),
                ("user_cue_in_override", "REAL"),
                ("user_cue_out_override", "REAL"),
                ("vocal_presence", "REAL DEFAULT 0.5"),
            ]
            for col_name, col_type in new_columns:
                if col_name not in existing_cols:
                    cursor.execute(f"ALTER TABLE tracks ADD COLUMN {col_name} {col_type}")

            # Indexes
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracks_filepath ON tracks(filepath)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracks_hash ON tracks(file_hash)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracks_mtime ON tracks(file_mtime)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracks_bpm ON tracks(bpm)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracks_camelot ON tracks(camelot_key)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracks_duplicate ON tracks(is_duplicate)")

            # Cue Points Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS cue_points (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    track_id INTEGER NOT NULL,
                    name TEXT,
                    time_seconds REAL NOT NULL,
                    cue_type TEXT DEFAULT 'cue',
                    created_at REAL,
                    FOREIGN KEY(track_id) REFERENCES tracks(id) ON DELETE CASCADE
                )
            """)

            # Mix History Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS mix_history (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT,
                    from_track_id INTEGER,
                    to_track_id INTEGER,
                    transition_type TEXT,
                    phrase_beats INTEGER,
                    rating INTEGER DEFAULT 0,
                    timestamp REAL,
                    notes TEXT,
                    FOREIGN KEY(from_track_id) REFERENCES tracks(id) ON DELETE SET NULL,
                    FOREIGN KEY(to_track_id) REFERENCES tracks(id) ON DELETE SET NULL
                )
            """)

            # DJ Sessions Table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS dj_sessions (
                    session_id TEXT PRIMARY KEY,
                    personality TEXT,
                    mode TEXT,
                    start_time REAL,
                    end_time REAL,
                    track_count INTEGER DEFAULT 0
                )
            """)

            conn.commit()

    def upsert_track(self, track: Track) -> int:
        now = time.time()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id FROM tracks WHERE filepath = ?", (track.filepath,))
            row = cursor.fetchone()

            if row:
                track_id = row["id"]
                cursor.execute("""
                    UPDATE tracks SET
                        filename = ?,
                        file_hash = ?,
                        file_size = ?,
                        file_mtime = ?,
                        file_format = ?,
                        title = ?,
                        artist = ?,
                        album = ?,
                        genre = ?,
                        year = ?,
                        duration = ?,
                        bpm = ?,
                        initial_key = ?,
                        camelot_key = ?,
                        energy = ?,
                        danceability = ?,
                        vocal_presence = ?,
                        loudness = ?,
                        sample_rate = ?,
                        bitrate = ?,
                        channels = ?,
                        cue_in = ?,
                        cue_out = ?,
                        phrase_length = ?,
                        is_duplicate = ?,
                        duplicate_of_id = ?,
                        scan_status = ?,
                        scan_error = ?,
                        user_bpm_override = COALESCE(?, user_bpm_override),
                        user_key_override = COALESCE(?, user_key_override),
                        user_cue_in_override = COALESCE(?, user_cue_in_override),
                        user_cue_out_override = COALESCE(?, user_cue_out_override),
                        updated_at = ?
                    WHERE id = ?
                """, (
                    track.filename, track.file_hash, track.file_size, track.file_mtime,
                    track.file_format, track.title, track.artist, track.album,
                    track.genre, track.year, track.duration, track.bpm,
                    track.initial_key, track.camelot_key, track.energy,
                    track.danceability, track.vocal_presence, track.loudness,
                    track.sample_rate, track.bitrate,
                    track.channels, track.cue_in, track.cue_out,
                    track.phrase_length, track.is_duplicate, track.duplicate_of_id,
                    track.scan_status, track.scan_error,
                    track.user_bpm_override, track.user_key_override,
                    track.user_cue_in_override, track.user_cue_out_override,
                    now, track_id
                ))
            else:
                cursor.execute("""
                    INSERT INTO tracks (
                        filepath, filename, file_hash, file_size, file_mtime, file_format,
                        title, artist, album, genre, year, duration, bpm, initial_key,
                        camelot_key, energy, danceability, vocal_presence, loudness, sample_rate, bitrate, channels,
                        cue_in, cue_out, phrase_length, is_duplicate, duplicate_of_id,
                        scan_status, scan_error, user_bpm_override, user_key_override,
                        user_cue_in_override, user_cue_out_override, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    track.filepath, track.filename, track.file_hash, track.file_size,
                    track.file_mtime, track.file_format, track.title, track.artist,
                    track.album, track.genre, track.year, track.duration, track.bpm,
                    track.initial_key, track.camelot_key, track.energy,
                    track.danceability, track.vocal_presence, track.loudness,
                    track.sample_rate, track.bitrate,
                    track.channels, track.cue_in, track.cue_out, track.phrase_length,
                    track.is_duplicate, track.duplicate_of_id, track.scan_status,
                    track.scan_error, track.user_bpm_override, track.user_key_override,
                    track.user_cue_in_override, track.user_cue_out_override, now, now
                ))
                track_id = cursor.lastrowid
            conn.commit()
            return track_id

    def set_track_user_override(
        self,
        track_id: int,
        bpm: Optional[float] = None,
        key: Optional[str] = None,
        cue_in: Optional[float] = None,
        cue_out: Optional[float] = None
    ) -> bool:
        """Allows users to manually correct inaccurate algorithmic estimates."""
        now = time.time()
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE tracks SET
                    user_bpm_override = COALESCE(?, user_bpm_override),
                    user_key_override = COALESCE(?, user_key_override),
                    user_cue_in_override = COALESCE(?, user_cue_in_override),
                    user_cue_out_override = COALESCE(?, user_cue_out_override),
                    updated_at = ?
                WHERE id = ?
            """, (bpm, key, cue_in, cue_out, now, track_id))
            conn.commit()
            return cursor.rowcount > 0

    def get_track_by_path(self, filepath: str) -> Optional[Track]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM tracks WHERE filepath = ?", (filepath,))
            row = cursor.fetchone()
            return Track.from_row(dict(row)) if row else None

    def get_track_by_id(self, track_id: int) -> Optional[Track]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM tracks WHERE id = ?", (track_id,))
            row = cursor.fetchone()
            return Track.from_row(dict(row)) if row else None

    def get_tracks_by_hash(self, file_hash: str) -> List[Track]:
        if not file_hash:
            return []
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM tracks WHERE file_hash = ? ORDER BY id ASC", (file_hash,))
            return [Track.from_row(dict(r)) for r in cursor.fetchall()]

    def get_all_tracks(self) -> List[Track]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM tracks ORDER BY artist, title")
            return [Track.from_row(dict(r)) for r in cursor.fetchall()]

    def get_duplicate_tracks(self) -> List[Track]:
        with self._get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM tracks WHERE is_duplicate = 1 ORDER BY file_hash")
            return [Track.from_row(dict(r)) for r in cursor.fetchall()]

    def delete_track_by_path(self, filepath: str):
        with self._get_connection() as conn:
            conn.execute("DELETE FROM tracks WHERE filepath = ?", (filepath,))
            conn.commit()

    def record_playback(self, track_id: int):
        now = time.time()
        with self._get_connection() as conn:
            conn.execute("""
                UPDATE tracks SET
                    play_count = play_count + 1,
                    last_played_at = ?
                WHERE id = ?
            """, (now, track_id))
            conn.commit()

    def record_mix(self, mix: MixRecord):
        now = mix.timestamp or time.time()
        with self._get_connection() as conn:
            conn.execute("""
                INSERT INTO mix_history (
                    session_id, from_track_id, to_track_id,
                    transition_type, phrase_beats, rating, timestamp, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (mix.session_id, mix.from_track_id, mix.to_track_id,
                  mix.transition_type, mix.phrase_beats, mix.rating, now, mix.notes))
            conn.commit()
