"""
MIXMIND - Master Backend Orchestrator & CLI
Runs autonomous/copilot DJ performance engine connecting VirtualDJ with local music database.
"""

import os
import sys
import time
import argparse
import logging

from .database.db import DatabaseManager, DEFAULT_DB_PATH
from .virtualdj.client import VirtualDJClient
from .dj_engine.controller import DJController
from .dj_engine.modes import DJMode
from .scanner.library_scanner import LibraryScanner

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("MIXMIND")


def main():
    parser = argparse.ArgumentParser(description="MIXMIND - AI DJ Production Engine")
    parser.add_argument("--music-dir", type=str, default=None, help="Path to local music library")
    parser.add_argument("--personality", type=str, default="club", choices=["club", "melodic", "festival"], help="DJ personality profile")
    parser.add_argument("--mode", type=str, default="autopilot", choices=["autopilot", "copilot", "manual"], help="DJ operating mode")
    parser.add_argument("--osc-port", type=int, default=8000, help="VirtualDJ OSC input port (default: 8000)")
    parser.add_argument("--db-path", type=str, default=DEFAULT_DB_PATH, help="Path to SQLite database")
    parser.add_argument("--scan-only", action="store_true", help="Scan and index library then exit")
    args = parser.parse_args()

    # Determine music directory
    music_dir = args.music_dir
    if not music_dir:
        desktop_songs = os.path.expanduser("~/Desktop/SONGS")
        if os.path.isdir(desktop_songs):
            music_dir = desktop_songs

    print("\n" + "=" * 65)
    print(" 🎧 MIXMIND • AI DJ PERFORMANCE SYSTEM")
    print("=" * 65)
    print(f" • Mode:           {args.mode.upper()}")
    print(f" • Personality:    {args.personality.upper()} DJ")
    print(f" • Music Library:  {music_dir or 'Not specified'}")
    print(f" • Database:       {args.db_path}")
    print(f" • VirtualDJ Port: {args.osc_port}")
    print("=" * 65 + "\n")

    # 1. Database & Library
    db = DatabaseManager(args.db_path)
    scanner = LibraryScanner(db=db)

    if music_dir:
        res = scanner.scan_folder(music_dir)
        print(f"Scan Summary: {res.supported_files} audio files found | {res.added} added | {res.updated} updated | {res.skipped_unchanged} unchanged | {res.duplicates_detected} duplicates")

    if args.scan_only:
        print("Scan complete. Exiting.")
        return

    # 2. VirtualDJ Client & DJ Controller
    client = VirtualDJClient(osc_port=args.osc_port)
    client.start()

    controller = DJController(
        db=db,
        client=client,
        personality_id=args.personality,
        mode=DJMode(args.mode)
    )

    all_tracks = db.get_all_tracks()
    if not all_tracks:
        logger.error("No tracks found in database! Please run with --music-dir to index your songs.")
        sys.exit(1)

    # Start playback on Deck 1
    first_track = all_tracks[0]
    controller.state_machine.start_playback(first_track)
    controller.history.append(first_track.filepath)

    print("\n[READY] MIXMIND is live! Press Ctrl+C to stop.\n")

    beat_counter = 0
    try:
        while True:
            active = controller.state_machine.active_deck
            current_bpm = client.deck_state[active].get("bpm", 124.0) or 124.0
            beat_duration = 60.0 / current_bpm

            controller.tick(beat_counter, current_bpm)

            phrase_length = controller.personality.preferred_phrase_length
            phrase_beat = beat_counter % phrase_length
            deck_info = f"D{active}: {client.deck_state[active]['title'][:18]}"
            cf_pct = int(client.deck_state["crossfader"] * 100)

            dots = "█" * (phrase_beat + 1) + "░" * (phrase_length - phrase_beat - 1)
            sys.stdout.write(
                f"\r[{dots[:32]}] B:{phrase_beat+1:02d}/{phrase_length} | {deck_info:<22} | CF:{cf_pct:02d}% | {controller.state_machine.status_message[:28]}"
            )
            sys.stdout.flush()

            beat_counter += 1
            time.sleep(beat_duration)

    except KeyboardInterrupt:
        print("\n\nStopping MIXMIND gracefully...")
        client.stop()
        print("Goodbye!")


if __name__ == "__main__":
    main()
