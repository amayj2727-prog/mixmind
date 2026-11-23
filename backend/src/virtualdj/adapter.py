"""
MIXMIND - VirtualDJ Modular Adapter Architecture
Separates MIXMIND's AI decision-making from VirtualDJ-specific communication and command execution.

Provides:
- IVirtualDJAdapter: Abstract base class defining all operational contracts.
- MockVirtualDJAdapter: High-fidelity simulation for development, testing, and VirtualDJ Home environments.
- RealVirtualDJAdapter: Documented, licensed integration for VirtualDJ Pro via OSC / Network Control.
- Command validation, manual takeover arbitration, error recovery, and structured logging.
"""

import os
import time
import socket
import logging
from abc import ABC, abstractmethod
from enum import Enum
from dataclasses import dataclass, asdict, field
from typing import Dict, Any, Optional, List, Tuple

from .client import VirtualDJClient
from .osc_protocol import build_osc_message, parse_osc_message

logger = logging.getLogger("VirtualDJAdapter")


class ConnectionStatus(str, Enum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    LICENSE_RESTRICTED = "license_restricted"  # VirtualDJ Pro license required for network control
    ERROR = "error"


@dataclass
class TrackInfo:
    title: str = "Ready"
    artist: str = "No Track Loaded"
    album: str = ""
    genre: str = ""
    bpm: float = 124.0
    key: str = "8A"
    duration: float = 0.0
    filepath: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DeckState:
    deck: int
    title: str = "Ready"
    artist: str = "No Track Loaded"
    filepath: str = ""
    bpm: float = 124.0
    key: str = "8A"
    playing: bool = False
    beat_pos: int = 0
    phrase_pos: int = 0
    pitch_slider_pct: float = 0.0
    time_elapsed: float = 0.0
    time_remaining: float = 180.0
    songpos: float = 0.0          # 0.0 to 1.0
    eq_low: float = 1.0           # 0.0 (kill) to 1.0 (unity), 2.0 (boost)
    eq_mid: float = 1.0
    eq_high: float = 1.0
    filter_val: float = 0.5       # 0.0 (full LPF), 0.5 (neutral/off), 1.0 (full HPF)
    stems: Dict[str, float] = field(default_factory=lambda: {
        "vocal": 1.0,
        "instruments": 1.0,
        "bass": 1.0,
        "drums": 1.0
    })
    loop_active: bool = False
    loop_length_beats: int = 0
    track_info: Optional[TrackInfo] = None

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        if self.track_info:
            d["track_info"] = self.track_info.to_dict()
        return d


class CommandValidator:
    """Validates parameters before dispatching commands to VirtualDJ or mock."""

    @staticmethod
    def validate_deck(deck: int) -> bool:
        return isinstance(deck, int) and 1 <= deck <= 4

    @staticmethod
    def validate_fader(val: float) -> float:
        return max(0.0, min(1.0, float(val)))

    @staticmethod
    def validate_eq(val: float) -> float:
        return max(0.0, min(2.0, float(val)))

    @staticmethod
    def validate_filepath(filepath: str) -> Tuple[bool, str]:
        if not filepath or not isinstance(filepath, str):
            return False, "Filepath must be a non-empty string."
        if not os.path.exists(filepath):
            return False, f"File does not exist on disk: {filepath}"
        return True, ""


class IVirtualDJAdapter(ABC):
    """Abstract Interface defining all supported VirtualDJ operations."""

    @property
    @abstractmethod
    def status(self) -> ConnectionStatus:
        """Current connection lifecycle status."""
        pass

    @property
    @abstractmethod
    def is_simulation(self) -> bool:
        """Returns True if operating under simulation/mock mode."""
        pass

    @property
    @abstractmethod
    def is_connected(self) -> bool:
        """Returns True if connection to VirtualDJ host is active."""
        pass

    @property
    @abstractmethod
    def manual_takeover_active(self) -> bool:
        """Returns True if a human DJ has engaged manual takeover."""
        pass

    @abstractmethod
    def enable_manual_takeover(self, reason: str = "DJ manual override"):
        """Locks out automated AI commands so human DJ has complete priority."""
        pass

    @abstractmethod
    def disable_manual_takeover(self):
        """Restores AI automation control."""
        pass

    @abstractmethod
    def connect(self) -> bool:
        """Establishes connection to VirtualDJ host or initializes simulation."""
        pass

    @abstractmethod
    def disconnect(self):
        """Disconnects and frees network/simulation resources."""
        pass

    # Track & Deck State
    @abstractmethod
    def get_deck_state(self, deck: int) -> DeckState:
        """Retrieves real-time deck telemetry and playback state."""
        pass

    @abstractmethod
    def get_track_info(self, deck: int) -> Optional[TrackInfo]:
        """Retrieves metadata of the track loaded on deck."""
        pass

    # Transport Controls
    @abstractmethod
    def load_track(self, deck: int, filepath: str) -> bool:
        """Loads a track into the specified deck."""
        pass

    @abstractmethod
    def play(self, deck: int) -> bool:
        """Starts playback on deck."""
        pass

    @abstractmethod
    def pause(self, deck: int) -> bool:
        """Pauses playback on deck."""
        pass

    @abstractmethod
    def stop(self, deck: int) -> bool:
        """Stops playback on deck and returns to cue."""
        pass

    @abstractmethod
    def sync(self, deck: int) -> bool:
        """Synchronizes deck tempo and beat grid."""
        pass

    @abstractmethod
    def cue(self, deck: int) -> bool:
        """Sets or jumps to cue point on deck."""
        pass

    @abstractmethod
    def set_loop(self, deck: int, beats: int) -> bool:
        """Activates loop on deck for specified beat length."""
        pass

    @abstractmethod
    def exit_loop(self, deck: int) -> bool:
        """Exits active loop on deck."""
        pass

    # Mixer & Stem Controls
    @abstractmethod
    def set_crossfader(self, position: float) -> bool:
        """Sets crossfader position (0.0 = full Deck 1, 1.0 = full Deck 2)."""
        pass

    @abstractmethod
    def set_eq(self, deck: int, low: float, mid: float, high: float) -> bool:
        """Sets 3-band EQ levels."""
        pass

    @abstractmethod
    def set_filter(self, deck: int, filter_val: float) -> bool:
        """Sets dual-mode filter (0.0 = LPF, 0.5 = neutral, 1.0 = HPF)."""
        pass

    @abstractmethod
    def set_stem(self, deck: int, stem_name: str, level: float) -> bool:
        """Controls stem volume (vocal, instruments, bass, drums)."""
        pass

    @abstractmethod
    def mute_stem(self, deck: int, stem_name: str) -> bool:
        """Mutes a specific stem on deck."""
        pass

    @abstractmethod
    def solo_stem(self, deck: int, stem_name: str) -> bool:
        """Solos a specific stem on deck, muting others."""
        pass

    # Transition Execution
    @abstractmethod
    def execute_transition_step(
        self,
        outgoing_deck: int,
        incoming_deck: int,
        crossfader: float,
        outgoing_eq: Optional[Tuple[float, float, float]] = None,
        incoming_eq: Optional[Tuple[float, float, float]] = None,
        outgoing_filter: Optional[float] = None,
        incoming_filter: Optional[float] = None
    ) -> bool:
        """Executes a coordinated transition parameter frame across mixer and decks."""
        pass

    # VDJScript Passthrough
    @abstractmethod
    def execute_vdjscript(self, script: str) -> bool:
        """Executes arbitrary VDJScript command string."""
        pass

    @abstractmethod
    def query_vdjscript(self, query: str) -> str:
        """Evaluates arbitrary VDJScript query string."""
        pass


class MockVirtualDJAdapter(IVirtualDJAdapter):
    """
    [SIMULATION] - Standalone VirtualDJ Mock Adapter.
    Enables development, testing, and operation in VirtualDJ Home environments
    without requiring a paid license or network configuration changes.
    """
    def __init__(self):
        self._status = ConnectionStatus.CONNECTED
        self._manual_takeover = False
        self._takeover_reason = ""
        self.crossfader = 0.5

        self.decks: Dict[int, DeckState] = {
            1: DeckState(deck=1, title="Deck 1 Standby"),
            2: DeckState(deck=2, title="Deck 2 Standby")
        }
        logger.info("[SIMULATION] MockVirtualDJAdapter initialized.")

    @property
    def status(self) -> ConnectionStatus:
        return self._status

    @property
    def is_simulation(self) -> bool:
        return True

    @property
    def is_connected(self) -> bool:
        return self._status == ConnectionStatus.CONNECTED

    @property
    def manual_takeover_active(self) -> bool:
        return self._manual_takeover

    def enable_manual_takeover(self, reason: str = "DJ manual override"):
        self._manual_takeover = True
        self._takeover_reason = reason
        logger.warning(f"Manual takeover ENABLED: {reason}. Automated commands will be blocked.")

    def disable_manual_takeover(self):
        self._manual_takeover = False
        self._takeover_reason = ""
        logger.info("Manual takeover DISABLED. AI automation restored.")

    def _check_takeover_block(self, action: str) -> bool:
        """Returns True if command should be blocked due to manual takeover."""
        if self._manual_takeover:
            logger.warning(f"Automation command '{action}' blocked: Manual takeover active ({self._takeover_reason}).")
            return True
        return False

    def connect(self) -> bool:
        self._status = ConnectionStatus.CONNECTED
        return True

    def disconnect(self):
        self._status = ConnectionStatus.DISCONNECTED
        logger.info("MockVirtualDJAdapter disconnected.")

    def get_deck_state(self, deck: int) -> DeckState:
        if deck not in self.decks:
            self.decks[deck] = DeckState(deck=deck)
        return self.decks[deck]

    def get_track_info(self, deck: int) -> Optional[TrackInfo]:
        st = self.get_deck_state(deck)
        return st.track_info

    def load_track(self, deck: int, filepath: str) -> bool:
        if self._check_takeover_block(f"load_track(deck={deck})"):
            return False

        if not CommandValidator.validate_deck(deck):
            logger.error(f"Invalid deck index: {deck}")
            return False

        is_valid, err = CommandValidator.validate_filepath(filepath)
        if not is_valid:
            logger.error(f"Cannot load track: {err}")
            return False

        fname = os.path.basename(filepath)
        title = os.path.splitext(fname)[0]

        info = TrackInfo(
            title=title,
            artist="Local Artist",
            filepath=filepath,
            bpm=124.0,
            key="8A",
            duration=240.0
        )

        st = self.get_deck_state(deck)
        st.filepath = filepath
        st.title = title
        st.artist = info.artist
        st.bpm = info.bpm
        st.key = info.key
        st.playing = False
        st.time_elapsed = 0.0
        st.time_remaining = info.duration
        st.songpos = 0.0
        st.track_info = info

        logger.info(f"Loaded track on Deck {deck}: '{title}' ({filepath})")
        return True

    def play(self, deck: int) -> bool:
        if self._check_takeover_block(f"play(deck={deck})"):
            return False
        st = self.get_deck_state(deck)
        st.playing = True
        logger.info(f"Deck {deck} PLAY")
        return True

    def pause(self, deck: int) -> bool:
        if self._check_takeover_block(f"pause(deck={deck})"):
            return False
        st = self.get_deck_state(deck)
        st.playing = False
        logger.info(f"Deck {deck} PAUSE")
        return True

    def stop(self, deck: int) -> bool:
        if self._check_takeover_block(f"stop(deck={deck})"):
            return False
        st = self.get_deck_state(deck)
        st.playing = False
        st.time_elapsed = 0.0
        st.songpos = 0.0
        logger.info(f"Deck {deck} STOP & REWIND")
        return True

    def sync(self, deck: int) -> bool:
        if self._check_takeover_block(f"sync(deck={deck})"):
            return False
        other_deck = 2 if deck == 1 else 1
        other_st = self.get_deck_state(other_deck)
        st = self.get_deck_state(deck)
        st.bpm = other_st.bpm
        st.pitch_slider_pct = other_st.pitch_slider_pct
        logger.info(f"Deck {deck} SYNC to Deck {other_deck} ({st.bpm:.1f} BPM)")
        return True

    def cue(self, deck: int) -> bool:
        if self._check_takeover_block(f"cue(deck={deck})"):
            return False
        st = self.get_deck_state(deck)
        st.playing = False
        st.time_elapsed = 0.0
        logger.info(f"Deck {deck} CUE")
        return True

    def set_loop(self, deck: int, beats: int) -> bool:
        if self._check_takeover_block(f"set_loop(deck={deck})"):
            return False
        st = self.get_deck_state(deck)
        st.loop_active = True
        st.loop_length_beats = max(1, int(beats))
        logger.info(f"Deck {deck} LOOP SET ({beats} beats)")
        return True

    def exit_loop(self, deck: int) -> bool:
        if self._check_takeover_block(f"exit_loop(deck={deck})"):
            return False
        st = self.get_deck_state(deck)
        st.loop_active = False
        st.loop_length_beats = 0
        logger.info(f"Deck {deck} LOOP EXIT")
        return True

    def set_crossfader(self, position: float) -> bool:
        if self._check_takeover_block("set_crossfader"):
            return False
        self.crossfader = CommandValidator.validate_fader(position)
        logger.debug(f"Crossfader set: {self.crossfader:.2f}")
        return True

    def set_eq(self, deck: int, low: float, mid: float, high: float) -> bool:
        if self._check_takeover_block(f"set_eq(deck={deck})"):
            return False
        st = self.get_deck_state(deck)
        st.eq_low = CommandValidator.validate_eq(low)
        st.eq_mid = CommandValidator.validate_eq(mid)
        st.eq_high = CommandValidator.validate_eq(high)
        logger.debug(f"Deck {deck} EQ: L={st.eq_low:.2f}, M={st.eq_mid:.2f}, H={st.eq_high:.2f}")
        return True

    def set_filter(self, deck: int, filter_val: float) -> bool:
        if self._check_takeover_block(f"set_filter(deck={deck})"):
            return False
        st = self.get_deck_state(deck)
        st.filter_val = CommandValidator.validate_fader(filter_val)
        logger.debug(f"Deck {deck} Filter: {st.filter_val:.2f}")
        return True

    def set_stem(self, deck: int, stem_name: str, level: float) -> bool:
        if self._check_takeover_block(f"set_stem(deck={deck}, stem={stem_name})"):
            return False
        st = self.get_deck_state(deck)
        if stem_name in st.stems:
            st.stems[stem_name] = CommandValidator.validate_fader(level)
            logger.debug(f"Deck {deck} Stem '{stem_name}': {st.stems[stem_name]:.2f}")
            return True
        return False

    def mute_stem(self, deck: int, stem_name: str) -> bool:
        return self.set_stem(deck, stem_name, 0.0)

    def solo_stem(self, deck: int, stem_name: str) -> bool:
        st = self.get_deck_state(deck)
        if stem_name not in st.stems:
            return False
        for s in st.stems:
            self.set_stem(deck, s, 1.0 if s == stem_name else 0.0)
        return True

    def execute_transition_step(
        self,
        outgoing_deck: int,
        incoming_deck: int,
        crossfader: float,
        outgoing_eq: Optional[Tuple[float, float, float]] = None,
        incoming_eq: Optional[Tuple[float, float, float]] = None,
        outgoing_filter: Optional[float] = None,
        incoming_filter: Optional[float] = None
    ) -> bool:
        if self._check_takeover_block("execute_transition_step"):
            return False

        self.set_crossfader(crossfader)
        if outgoing_eq:
            self.set_eq(outgoing_deck, *outgoing_eq)
        if incoming_eq:
            self.set_eq(incoming_deck, *incoming_eq)
        if outgoing_filter is not None:
            self.set_filter(outgoing_deck, outgoing_filter)
        if incoming_filter is not None:
            self.set_filter(incoming_deck, incoming_filter)
        return True

    def execute_vdjscript(self, script: str) -> bool:
        if self._check_takeover_block(f"execute_vdjscript({script})"):
            return False

        logger.debug(f"[SIMULATION] Interpreting VDJScript: {script}")
        parts = script.strip().split()
        if not parts:
            return False

        if parts[0] == "deck" and len(parts) >= 3:
            try:
                deck = int(parts[1])
                action = parts[2].lower()
                if action == "play":
                    self.play(deck)
                elif action == "pause":
                    self.pause(deck)
                elif action == "sync":
                    self.sync(deck)
                elif action == "stop":
                    self.stop(deck)
                elif action == "load" and len(parts) >= 4:
                    path = " ".join(parts[3:]).strip('"')
                    self.load_track(deck, path)
            except Exception as e:
                logger.error(f"Error executing mock script '{script}': {e}")
                return False
        return True

    def query_vdjscript(self, query: str) -> str:
        parts = query.strip().split()
        if len(parts) >= 3 and parts[0] == "deck":
            try:
                deck = int(parts[1])
                prop = parts[2].lower()
                st = self.get_deck_state(deck)
                if prop == "get_bpm":
                    return str(st.bpm)
                elif prop in ("get_time", "songpos"):
                    return str(st.time_elapsed)
                elif prop == "get_key":
                    return str(st.key)
                elif prop == "is_playing":
                    return "true" if st.playing else "false"
                elif prop == "get_title":
                    return st.title
                elif prop == "get_artist":
                    return st.artist
            except Exception:
                pass
        return ""


class RealVirtualDJAdapter(IVirtualDJAdapter):
    """
    Live VirtualDJ Adapter for documented, licensed VirtualDJ Pro integrations.
    Communicates via UDP OSC (oscPort/oscPortBack) and Network Control HTTP endpoints.

    Strict Safety Rule:
    When connected to a VirtualDJ Home tier where network ports are inactive,
    marks status as LICENSE_RESTRICTED and halts external execution cleanly.
    """
    def __init__(self, host: str = "127.0.0.1", osc_port: int = 8000, listen_port: int = 9000):
        self.host = host
        self.osc_port = osc_port
        self.listen_port = listen_port
        self.client = VirtualDJClient(host=host, osc_port=osc_port, listen_port=listen_port)
        self._status = ConnectionStatus.DISCONNECTED
        self._manual_takeover = False
        self._takeover_reason = ""
        self._max_retries = 3

    @property
    def status(self) -> ConnectionStatus:
        return self._status

    @property
    def is_simulation(self) -> bool:
        return False

    @property
    def is_connected(self) -> bool:
        return self._status == ConnectionStatus.CONNECTED and getattr(self.client, "connected", False)

    @property
    def manual_takeover_active(self) -> bool:
        return self._manual_takeover

    def enable_manual_takeover(self, reason: str = "DJ manual override"):
        self._manual_takeover = True
        self._takeover_reason = reason
        logger.warning(f"[REAL VDJ] Manual takeover ENABLED: {reason}. Automated commands suspended.")

    def disable_manual_takeover(self):
        self._manual_takeover = False
        self._takeover_reason = ""
        logger.info("[REAL VDJ] Manual takeover DISABLED. Automation restored.")

    def _check_takeover_block(self, action: str) -> bool:
        if self._manual_takeover:
            logger.warning(f"[REAL VDJ] Command '{action}' rejected: Manual takeover active ({self._takeover_reason}).")
            return True
        return False

    def connect(self) -> bool:
        """
        Attempts connection to VirtualDJ host.
        Validates whether network ports are accessible or restricted by license.
        """
        self._status = ConnectionStatus.CONNECTING
        logger.info(f"Connecting to VirtualDJ at {self.host}:{self.osc_port}...")

        try:
            self.client.start()
            # Send status ping
            self.client.send_osc("/vdj", "get_status")
            self._status = ConnectionStatus.CONNECTED
            logger.info("RealVirtualDJAdapter connected.")
            return True
        except socket.error as e:
            logger.warning(
                f"Could not bind to VirtualDJ network socket: {e}. "
                "NOTE: VirtualDJ Home restricts incoming network controls (VirtualDJ Pro required)."
            )
            self._status = ConnectionStatus.LICENSE_RESTRICTED
            return False
        except Exception as e:
            logger.error(f"Error connecting to VirtualDJ: {e}")
            self._status = ConnectionStatus.ERROR
            return False

    def disconnect(self):
        self.client.stop()
        self._status = ConnectionStatus.DISCONNECTED
        logger.info("RealVirtualDJAdapter disconnected.")

    def __del__(self):
        try:
            self.disconnect()
        except Exception:
            pass

    def _execute_with_retry(self, action_fn, action_name: str) -> bool:
        """Executes a command with error recovery and retry logic."""
        if self._status == ConnectionStatus.LICENSE_RESTRICTED:
            logger.warning(f"Cannot execute '{action_name}': VirtualDJ Pro license required for network control.")
            return False

        for attempt in range(1, self._max_retries + 1):
            try:
                action_fn()
                return True
            except Exception as e:
                logger.warning(f"Error executing '{action_name}' (attempt {attempt}/{self._max_retries}): {e}")
                time.sleep(0.05 * attempt)

        logger.error(f"Failed to execute '{action_name}' after {self._max_retries} attempts.")
        return False

    def get_deck_state(self, deck: int) -> DeckState:
        raw = self.client.deck_state.get(deck, {})
        return DeckState(
            deck=deck,
            title=raw.get("title", "Ready"),
            artist=raw.get("artist", ""),
            bpm=float(raw.get("bpm", 124.0)),
            key=str(raw.get("key", "8A")),
            playing=bool(raw.get("playing", False)),
            beat_pos=int(raw.get("beat_pos", 0)),
            phrase_pos=int(raw.get("phrase_pos", 0)),
            time_remaining=float(raw.get("time_remaining", 180.0)),
            eq_low=float(raw.get("eq_low", 1.0)),
            eq_mid=float(raw.get("eq_mid", 1.0)),
            eq_high=float(raw.get("eq_high", 1.0)),
            filter_val=float(raw.get("filter", 0.5)),
            stems={
                "vocal": float(raw.get("stem_vocal", 1.0)),
                "instruments": float(raw.get("stem_instruments", 1.0)),
                "bass": float(raw.get("stem_bass", 1.0)),
                "drums": float(raw.get("stem_drums", 1.0)),
            }
        )

    def get_track_info(self, deck: int) -> Optional[TrackInfo]:
        st = self.get_deck_state(deck)
        return TrackInfo(
            title=st.title,
            artist=st.artist,
            bpm=st.bpm,
            key=st.key,
            filepath=st.filepath
        )

    def load_track(self, deck: int, filepath: str) -> bool:
        if self._check_takeover_block(f"load_track({deck})"):
            return False
        is_valid, err = CommandValidator.validate_filepath(filepath)
        if not is_valid:
            logger.error(f"Cannot load track: {err}")
            return False
        return self._execute_with_retry(
            lambda: self.client.deck_load(deck, filepath),
            f"load_track({deck}, {filepath})"
        )

    def play(self, deck: int) -> bool:
        if self._check_takeover_block(f"play({deck})"):
            return False
        return self._execute_with_retry(
            lambda: self.client.deck_play(deck),
            f"play({deck})"
        )

    def pause(self, deck: int) -> bool:
        if self._check_takeover_block(f"pause({deck})"):
            return False
        return self._execute_with_retry(
            lambda: self.client.deck_pause(deck),
            f"pause({deck})"
        )

    def stop(self, deck: int) -> bool:
        if self._check_takeover_block(f"stop({deck})"):
            return False
        return self._execute_with_retry(
            lambda: self.client.send_osc(f"/vdj/deck/{deck}/stop"),
            f"stop({deck})"
        )

    def sync(self, deck: int) -> bool:
        if self._check_takeover_block(f"sync({deck})"):
            return False
        return self._execute_with_retry(
            lambda: self.client.deck_sync(deck),
            f"sync({deck})"
        )

    def cue(self, deck: int) -> bool:
        if self._check_takeover_block(f"cue({deck})"):
            return False
        return self._execute_with_retry(
            lambda: self.client.send_osc(f"/vdj/deck/{deck}/cue"),
            f"cue({deck})"
        )

    def set_loop(self, deck: int, beats: int) -> bool:
        if self._check_takeover_block(f"set_loop({deck})"):
            return False
        return self._execute_with_retry(
            lambda: self.client.send_osc("/vdj", f"deck {deck} loop {beats}"),
            f"set_loop({deck}, {beats})"
        )

    def exit_loop(self, deck: int) -> bool:
        if self._check_takeover_block(f"exit_loop({deck})"):
            return False
        return self._execute_with_retry(
            lambda: self.client.send_osc("/vdj", f"deck {deck} loop_exit"),
            f"exit_loop({deck})"
        )

    def set_crossfader(self, position: float) -> bool:
        if self._check_takeover_block("set_crossfader"):
            return False
        pos = CommandValidator.validate_fader(position)
        return self._execute_with_retry(
            lambda: self.client.set_crossfader(pos),
            f"set_crossfader({pos:.2f})"
        )

    def set_eq(self, deck: int, low: float, mid: float, high: float) -> bool:
        if self._check_takeover_block(f"set_eq({deck})"):
            return False
        return self._execute_with_retry(
            lambda: (
                self.client.set_eq_low(deck, low),
                self.client.set_eq_mid(deck, mid),
                self.client.set_eq_high(deck, high)
            ),
            f"set_eq({deck})"
        )

    def set_filter(self, deck: int, filter_val: float) -> bool:
        if self._check_takeover_block(f"set_filter({deck})"):
            return False
        val = CommandValidator.validate_fader(filter_val)
        return self._execute_with_retry(
            lambda: self.client.set_filter(deck, val),
            f"set_filter({deck}, {val:.2f})"
        )

    def set_stem(self, deck: int, stem_name: str, level: float) -> bool:
        if self._check_takeover_block(f"set_stem({deck}, {stem_name})"):
            return False
        val = CommandValidator.validate_fader(level)
        return self._execute_with_retry(
            lambda: (
                self.client.set_stem_vocal(deck, val) if stem_name == "vocal" else
                self.client.set_stem_bass(deck, val) if stem_name == "bass" else
                self.client.set_stem_instruments(deck, val) if stem_name == "instruments" else
                self.client.set_stem_drums(deck, val) if stem_name == "drums" else None
            ),
            f"set_stem({deck}, {stem_name}, {val:.2f})"
        )

    def mute_stem(self, deck: int, stem_name: str) -> bool:
        return self.set_stem(deck, stem_name, 0.0)

    def solo_stem(self, deck: int, stem_name: str) -> bool:
        if self._check_takeover_block(f"solo_stem({deck}, {stem_name})"):
            return False
        return self._execute_with_retry(
            lambda: self.client.send_osc("/vdj", f"deck {deck} stem_solo '{stem_name}'"),
            f"solo_stem({deck}, {stem_name})"
        )

    def execute_transition_step(
        self,
        outgoing_deck: int,
        incoming_deck: int,
        crossfader: float,
        outgoing_eq: Optional[Tuple[float, float, float]] = None,
        incoming_eq: Optional[Tuple[float, float, float]] = None,
        outgoing_filter: Optional[float] = None,
        incoming_filter: Optional[float] = None
    ) -> bool:
        if self._check_takeover_block("execute_transition_step"):
            return False

        self.set_crossfader(crossfader)
        if outgoing_eq:
            self.set_eq(outgoing_deck, *outgoing_eq)
        if incoming_eq:
            self.set_eq(incoming_deck, *incoming_eq)
        if outgoing_filter is not None:
            self.set_filter(outgoing_deck, outgoing_filter)
        if incoming_filter is not None:
            self.set_filter(incoming_deck, incoming_filter)
        return True

    def execute_vdjscript(self, script: str) -> bool:
        if self._check_takeover_block(f"execute_vdjscript({script})"):
            return False
        return self._execute_with_retry(
            lambda: self.client.send_osc("/vdj", script),
            f"execute_vdjscript({script})"
        )

    def query_vdjscript(self, query: str) -> str:
        self.client.send_osc("/vdj/query", query)
        return ""


# Backwards compatibility aliases
VirtualDJMockAdapter = MockVirtualDJAdapter
VirtualDJLiveAdapter = RealVirtualDJAdapter


def get_virtualdj_adapter(force_simulation: bool = True) -> IVirtualDJAdapter:
    """
    Factory function returning the appropriate VirtualDJ adapter.
    Defaults to MockVirtualDJAdapter in VirtualDJ Home environments.
    """
    if force_simulation:
        return MockVirtualDJAdapter()

    try:
        live = RealVirtualDJAdapter()
        if live.connect():
            return live
    except Exception as e:
        logger.info(f"Live adapter unavailable ({e}); defaulting to mock adapter.")

    return MockVirtualDJAdapter()
