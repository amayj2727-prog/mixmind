"""
MIXMIND - Transition State Machine
Orchestrates multi-beat phrase transitions (intro blend, tension buildup, downbeat drop, outro).
"""

import time
import logging
from typing import Optional

from ..virtualdj.client import VirtualDJClient
from ..database.models import Track
from ..intelligence.personalities import DJPersonality, get_personality
from .curves import linear_curve, filter_sweep_curve

logger = logging.getLogger("TransitionStateMachine")


class TransitionState:
    IDLE = "IDLE"
    MONITORING = "MONITORING"
    PREPARING = "PREPARING"
    INTRO_BLEND = "INTRO_BLEND"
    BUILDUP = "BUILDUP"
    THE_DROP = "THE_DROP"
    OUTRO_FADE = "OUTRO_FADE"
    HANDOFF = "HANDOFF"


class TransitionStateMachine:
    def __init__(self, client: VirtualDJClient, personality: Optional[DJPersonality] = None):
        self.client = client
        self.personality = personality or get_personality("club")
        self.state = TransitionState.IDLE
        self.active_deck = 1
        self.incoming_deck = 2
        self.next_track: Optional[Track] = None

        self.transition_beat_counter = 0
        self.last_beat_processed = -1
        self.status_message = "Transition engine ready."

    def set_personality(self, personality: DJPersonality):
        self.personality = personality

    def start_playback(self, first_track: Track):
        self.active_deck = 1
        self.incoming_deck = 2

        self.client.deck_state[1]["title"] = first_track.title
        self.client.deck_state[1]["artist"] = first_track.artist
        self.client.deck_state[1]["bpm"] = first_track.bpm
        self.client.deck_state[1]["key"] = first_track.camelot_key
        self.client.deck_load(1, first_track.filepath)

        self.client.set_crossfader(0.0)
        self.client.set_eq_low(1, 1.0)
        self.client.set_eq_mid(1, 1.0)
        self.client.set_eq_high(1, 1.0)
        self.client.set_filter(1, 0.5)

        self.client.deck_play(1)
        self.state = TransitionState.MONITORING
        self.status_message = f"Playing {first_track.title} on Deck 1"

    def prepare_incoming(self, next_track: Track):
        self.next_track = next_track
        self.state = TransitionState.PREPARING

        self.client.deck_state[self.incoming_deck]["title"] = next_track.title
        self.client.deck_state[self.incoming_deck]["artist"] = next_track.artist
        self.client.deck_state[self.incoming_deck]["bpm"] = next_track.bpm
        self.client.deck_state[self.incoming_deck]["key"] = next_track.camelot_key

        self.client.deck_load(self.incoming_deck, next_track.filepath)
        self.client.deck_sync(self.incoming_deck)

        # Mute incoming bass in advance
        self.client.set_eq_low(self.incoming_deck, 0.0)
        self.client.set_eq_mid(self.incoming_deck, 0.6)
        self.client.set_eq_high(self.incoming_deck, 0.6)
        self.client.set_filter(self.incoming_deck, 0.5)

        self.status_message = f"Queued {next_track.title} on Deck {self.incoming_deck}"

    def launch_transition(self):
        logger.info(f"Launching Transition: Deck {self.active_deck} -> Deck {self.incoming_deck}")
        self.client.deck_play(self.incoming_deck)
        self.transition_beat_counter = 0
        self.state = TransitionState.INTRO_BLEND

    def tick(self, current_beat: int, bpm: float):
        profile = self.personality.transition

        if self.state == TransitionState.INTRO_BLEND:
            self.transition_beat_counter += 1
            progress = min(1.0, self.transition_beat_counter / float(profile.intro_beats))

            start_cf = 0.0 if self.active_deck == 1 else 1.0
            current_cf = linear_curve(progress, start_cf, 0.5)
            self.client.set_crossfader(current_cf)

            self.client.set_eq_high(self.incoming_deck, linear_curve(progress, 0.5, 0.8))
            self.client.set_eq_mid(self.incoming_deck, linear_curve(progress, 0.5, 0.8))
            self.status_message = f"[INTRO BLEND] ({self.transition_beat_counter}/{profile.intro_beats})"

            if self.transition_beat_counter >= profile.intro_beats:
                self.state = TransitionState.BUILDUP

        elif self.state == TransitionState.BUILDUP:
            self.transition_beat_counter += 1
            buildup_progress = min(1.0, (self.transition_beat_counter - profile.intro_beats) / float(profile.buildup_beats))

            # Filter sweep on outgoing deck
            filter_val = filter_sweep_curve(buildup_progress, 0.5, 0.5 + profile.filter_sweep_intensity)
            self.client.set_filter(self.active_deck, filter_val)

            # Duck vocal on outgoing deck
            vocal_level = 1.0 - (profile.vocal_ducking_depth * buildup_progress)
            self.client.set_stem_vocal(self.active_deck, vocal_level)

            self.status_message = f"[BUILDUP & TENSION] High-Pass sweep ({self.transition_beat_counter}/{profile.intro_beats + profile.buildup_beats})"

            if self.transition_beat_counter >= (profile.intro_beats + profile.buildup_beats):
                self.state = TransitionState.THE_DROP

        elif self.state == TransitionState.THE_DROP:
            # Snap-swap downbeat bass
            self.client.set_eq_low(self.active_deck, 0.0)
            self.client.set_eq_low(self.incoming_deck, 1.0)
            self.client.set_filter(self.incoming_deck, 0.5)
            self.status_message = ">>> [THE DROP] INSTANT BASS SWAP! <<<"
            self.state = TransitionState.OUTRO_FADE

        elif self.state == TransitionState.OUTRO_FADE:
            self.transition_beat_counter += 1
            total_prior = profile.intro_beats + profile.buildup_beats
            outro_progress = min(1.0, (self.transition_beat_counter - total_prior) / float(profile.outro_beats))

            target_cf = 1.0 if self.active_deck == 1 else 0.0
            current_cf = linear_curve(outro_progress, 0.5, target_cf)
            self.client.set_crossfader(current_cf)

            self.client.set_eq_high(self.active_deck, 0.8 * (1.0 - outro_progress))
            self.client.set_eq_mid(self.active_deck, 0.8 * (1.0 - outro_progress))

            self.status_message = f"[OUTRO FADE] Completing mix handoff"

            if outro_progress >= 1.0:
                self._finish_handoff()

        self.last_beat_processed = current_beat

    def _finish_handoff(self):
        self.client.deck_pause(self.active_deck)
        self.client.set_eq_low(self.active_deck, 1.0)
        self.client.set_eq_mid(self.active_deck, 1.0)
        self.client.set_eq_high(self.active_deck, 1.0)
        self.client.set_filter(self.active_deck, 0.5)
        self.client.set_stem_vocal(self.active_deck, 1.0)

        old_active = self.active_deck
        self.active_deck = self.incoming_deck
        self.incoming_deck = old_active

        self.state = TransitionState.MONITORING
        self.status_message = f"Deck {self.active_deck} Solo Playing"
