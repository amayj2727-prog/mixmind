"""
MIXMIND - DJ Engine Master Controller
Coordinates DJ operating modes (Autopilot, Copilot, Manual) with AI Music Director and transitions.
"""

import logging
from typing import List, Dict, Any, Optional

from .modes import DJMode
from ..database.db import DatabaseManager
from ..database.models import Track
from ..intelligence.personalities import DJPersonality, get_personality
from ..intelligence.music_director import MusicDirector, EnergyPhase
from ..transitions.state_machine import TransitionStateMachine, TransitionState
from ..virtualdj.client import VirtualDJClient

logger = logging.getLogger("DJController")


class DJController:
    def __init__(
        self,
        db: DatabaseManager,
        client: VirtualDJClient,
        personality_id: str = "club",
        mode: DJMode = DJMode.AUTOPILOT
    ):
        self.db = db
        self.client = client
        self.mode = mode
        self.personality: DJPersonality = get_personality(personality_id)
        self.director = MusicDirector(db=self.db, personality_id=personality_id)
        self.state_machine = TransitionStateMachine(client=self.client, personality=self.personality)
        self.pending_recommendation: Optional[Dict[str, Any]] = None

    def set_personality(self, personality_id: str):
        self.personality = get_personality(personality_id)
        self.director.set_personality(personality_id)
        self.state_machine.set_personality(self.personality)
        logger.info(f"DJ Controller personality updated to: {self.personality.name}")

    def set_mode(self, mode: DJMode):
        self.mode = mode
        logger.info(f"DJ Mode updated to: {self.mode.value.upper()}")

    def set_energy_phase(self, phase: str):
        self.director.set_energy_phase(phase)

    def set_target_genre(self, genre: Optional[str]):
        self.director.set_target_genre(genre)

    def get_recommendations(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Generates scored next-track recommendations via AI Music Director."""
        active = self.state_machine.active_deck
        current_state = self.client.deck_state[active]

        # Construct current track object for comparison
        current_track = Track(
            filepath=current_state.get("filepath", "/active/track.mp3"),
            filename=current_state.get("title", "Active Track"),
            file_hash="",
            title=current_state.get("title", "Active Track"),
            artist=current_state.get("artist", "Active Artist"),
            bpm=current_state.get("bpm", 124.0),
            camelot_key=current_state.get("key", "8A"),
            energy=0.7
        )

        return self.director.recommend_next_tracks(current_track=current_track, limit=limit)

    def approve_recommendation(self, track: Track):
        """User approves track in Copilot mode."""
        self.director.record_played(track)
        self.state_machine.prepare_incoming(track)
        self.pending_recommendation = None
        logger.info(f"Copilot recommendation approved: {track.title}")

    def reject_recommendation(self, track_id: int, reason: str = "") -> List[Dict[str, Any]]:
        """User rejects candidate track in Copilot mode; adapts model and returns fresh candidates."""
        self.director.reject_recommendation(track_id, reason=reason)
        return self.get_recommendations(limit=5)

    def tick(self, current_beat: int, current_bpm: float):
        """Main tick loop called on each beat clock event."""
        if self.mode == DJMode.MANUAL:
            return

        phrase_length = self.personality.preferred_phrase_length
        beat_in_phrase = current_beat % phrase_length

        if self.state_machine.state == TransitionState.MONITORING:
            active = self.state_machine.active_deck
            time_left = self.client.deck_state[active]["time_remaining"]

            if time_left <= 45.0 or (time_left <= 60.0 and beat_in_phrase == 0):
                recs = self.get_recommendations(limit=1)
                if recs:
                    best = recs[0]["track"]
                    if self.mode == DJMode.AUTOPILOT:
                        self.director.record_played(best)
                        self.state_machine.prepare_incoming(best)
                    elif self.mode == DJMode.COPILOT:
                        self.pending_recommendation = recs[0]

        elif self.state_machine.state == TransitionState.PREPARING:
            if beat_in_phrase == 0:
                self.state_machine.launch_transition()

        # Step transition state machine
        self.state_machine.tick(current_beat, current_bpm)
