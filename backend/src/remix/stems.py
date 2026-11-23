"""
MIXMIND - Real-Time Stem Control & Clash Management
Controls VirtualDJ 4-stem isolation: vocal, instruments, bass, drums.
Integrates via documented VDJScript/OSC interfaces with clear separation from simulation.
"""

import logging
from typing import Dict, Any, Optional
from ..virtualdj.client import VirtualDJClient

logger = logging.getLogger("StemController")

STEM_NAMES = ("vocal", "instruments", "bass", "drums")


class MockStemEngine:
    """
    [SIMULATION] - Offline / Headless Stem Engine Simulator.
    Simulates real-time 4-stem separation and gain states when VirtualDJ host is not connected.
    Clearly designated as a software simulation for offline previewing and unit testing.
    """
    def __init__(self):
        self.is_simulation = True
        self.deck_stems = {
            1: {"vocal": 1.0, "instruments": 1.0, "bass": 1.0, "drums": 1.0},
            2: {"vocal": 1.0, "instruments": 1.0, "bass": 1.0, "drums": 1.0}
        }
        logger.info("[SIMULATION] MockStemEngine initialized: 4-stem simulation ready.")

    def set_stem(self, deck: int, stem_name: str, level: float):
        if deck in self.deck_stems and stem_name in STEM_NAMES:
            self.deck_stems[deck][stem_name] = max(0.0, min(1.0, float(level)))

    def get_stem(self, deck: int, stem_name: str) -> float:
        return self.deck_stems.get(deck, {}).get(stem_name, 1.0)

    def mute_stem(self, deck: int, stem_name: str):
        self.set_stem(deck, stem_name, 0.0)

    def solo_stem(self, deck: int, stem_name: str):
        if deck in self.deck_stems and stem_name in STEM_NAMES:
            for s in STEM_NAMES:
                self.deck_stems[deck][s] = 1.0 if s == stem_name else 0.0

    def restore_all(self, deck: int):
        if deck in self.deck_stems:
            for s in STEM_NAMES:
                self.deck_stems[deck][s] = 1.0

    def get_state(self, deck: int) -> Dict[str, float]:
        return dict(self.deck_stems.get(deck, {}))


class StemController:
    """
    Controls VirtualDJ deck stem levels (vocal, instruments, bass, drums).
    Directs commands to VirtualDJClient via OSC / VDJScript.
    Falls back gracefully to MockStemEngine simulation when VirtualDJ is not connected.
    """
    def __init__(self, client: Optional[VirtualDJClient] = None):
        self.client = client
        self.mock_engine = MockStemEngine()
        self._simulation_mode = client is None

    @property
    def is_simulation(self) -> bool:
        if self._simulation_mode or self.client is None:
            return True
        return not getattr(self.client, "connected", False)

    def set_stem(self, deck: int, stem_name: str, level: float):
        """Sets individual stem volume (0.0 to 1.0)."""
        val = max(0.0, min(1.0, float(level)))
        # Always update mock engine state for tracking
        self.mock_engine.set_stem(deck, stem_name, val)

        if self.client:
            if stem_name == "vocal":
                self.client.set_stem_vocal(deck, val)
            elif stem_name == "bass":
                self.client.set_stem_bass(deck, val)
            elif stem_name == "instruments":
                self.client.set_stem_instruments(deck, val)
            elif stem_name == "drums":
                self.client.set_stem_drums(deck, val)

    def get_stem(self, deck: int, stem_name: str) -> float:
        if self.client and deck in self.client.deck_state:
            key = f"stem_{stem_name}"
            if key in self.client.deck_state[deck]:
                return float(self.client.deck_state[deck][key])
        return self.mock_engine.get_stem(deck, stem_name)

    def mute_stem(self, deck: int, stem_name: str):
        """Mutes a specific stem on a deck."""
        self.set_stem(deck, stem_name, 0.0)

    def restore_stem(self, deck: int, stem_name: str):
        """Restores a specific stem to full unity level (1.0)."""
        self.set_stem(deck, stem_name, 1.0)

    def solo_stem(self, deck: int, stem_name: str):
        """Solos a single stem by muting all other stems on that deck."""
        for s in STEM_NAMES:
            level = 1.0 if s == stem_name else 0.0
            self.set_stem(deck, s, level)

    def isolate_vocals(self, deck: int):
        """Solos the vocal stem (mutes drums, bass, instruments)."""
        self.solo_stem(deck, "vocal")

    def isolate_instrumental(self, deck: int):
        """Mutes vocals, preserving drums, bass, and instruments."""
        self.set_stem(deck, "vocal", 0.0)
        self.set_stem(deck, "instruments", 1.0)
        self.set_stem(deck, "bass", 1.0)
        self.set_stem(deck, "drums", 1.0)

    def isolate_drums(self, deck: int):
        """Solos the drum stem."""
        self.solo_stem(deck, "drums")

    def isolate_bass(self, deck: int):
        """Solos the bass stem."""
        self.solo_stem(deck, "bass")

    def restore_all(self, deck: int):
        """Restores all 4 stems to full 1.0."""
        for s in STEM_NAMES:
            self.set_stem(deck, s, 1.0)

    def apply_vocal_ducking(self, deck: int, duck_depth: float):
        """Reduces vocal volume by duck_depth (e.g. 0.30 -> level 0.70)."""
        level = max(0.0, min(1.0, 1.0 - duck_depth))
        self.set_stem(deck, "vocal", level)

    def apply_stem_allocation(self, deck: int, allocation: Dict[str, float]):
        """Applies a multi-stem configuration: {'vocal': 1.0, 'bass': 0.0, ...}"""
        for stem_name, level in allocation.items():
            if stem_name in STEM_NAMES:
                self.set_stem(deck, stem_name, level)
