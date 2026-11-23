"""
MIXMIND - VirtualDJ Integration Client
Communicates bidirectionally via OSC to control decks, EQs, stems, crossfader, and listen to telemetry.
"""

import socket
import threading
import time
import logging
from typing import Dict, Any, Optional

from .osc_protocol import build_osc_message, parse_osc_message

logger = logging.getLogger("VDJClient")


class VirtualDJClient:
    def __init__(self, host: str = "127.0.0.1", osc_port: int = 8000, listen_port: int = 9000):
        self.host = host
        self.osc_port = osc_port
        self.listen_port = listen_port

        self.deck_state = {
            1: {
                "title": "Deck 1 Ready",
                "artist": "Waiting for track...",
                "bpm": 124.0,
                "key": "8A",
                "playing": False,
                "beat_pos": 0,
                "phrase_pos": 0,
                "time_remaining": 180.0,
                "eq_low": 1.0,
                "eq_mid": 1.0,
                "eq_high": 1.0,
                "filter": 0.5,
                "stem_vocal": 1.0,
                "stem_instruments": 1.0,
                "stem_bass": 1.0,
                "stem_drums": 1.0,
            },
            2: {
                "title": "Deck 2 Ready",
                "artist": "Waiting for track...",
                "bpm": 124.0,
                "key": "8A",
                "playing": False,
                "beat_pos": 0,
                "phrase_pos": 0,
                "time_remaining": 180.0,
                "eq_low": 1.0,
                "eq_mid": 1.0,
                "eq_high": 1.0,
                "filter": 0.5,
                "stem_vocal": 1.0,
                "stem_instruments": 1.0,
                "stem_bass": 1.0,
                "stem_drums": 1.0,
            },
            "crossfader": 0.0,
            "active_deck": 1,
        }

        self.running = False
        self.udp_sock: Optional[socket.socket] = None
        self.send_sock: Optional[socket.socket] = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self.connected = False

    def start(self):
        """Starts OSC listener thread."""
        self.running = True
        try:
            self.udp_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            self.udp_sock.settimeout(0.5)
            self.udp_sock.bind(("0.0.0.0", self.listen_port))
            logger.info(f"VirtualDJ OSC Listener active on port {self.listen_port}")
        except Exception as e:
            logger.warning(f"Could not bind listener to port {self.listen_port}: {e}")

        threading.Thread(target=self._osc_listen_loop, daemon=True).start()

    def stop(self):
        """Cleans up sockets and background threads."""
        self.running = False
        if self.udp_sock:
            try:
                self.udp_sock.close()
            except Exception:
                pass
        if self.send_sock:
            try:
                self.send_sock.close()
            except Exception:
                pass

    def send_osc(self, address: str, *args):
        """Dispatches an OSC packet to VirtualDJ."""
        try:
            packet = build_osc_message(address, *args)
            if self.send_sock:
                self.send_sock.sendto(packet, (self.host, self.osc_port))
            self.connected = True
        except Exception as e:
            logger.debug(f"Failed to send OSC to {self.host}:{self.osc_port}: {e}")

    # Deck Actions
    def deck_load(self, deck: int, filepath: str):
        self.send_osc(f"/vdj/deck/{deck}/load", filepath)
        self.send_osc("/vdj", f'deck {deck} load "{filepath}"')
        self.send_osc("/vdj/cmd", f'deck {deck} load "{filepath}"')

    def deck_play(self, deck: int):
        self.deck_state[deck]["playing"] = True
        self.send_osc(f"/vdj/deck/{deck}/play", 1.0)
        self.send_osc("/vdj", f"deck {deck} play")

    def deck_pause(self, deck: int):
        self.deck_state[deck]["playing"] = False
        self.send_osc(f"/vdj/deck/{deck}/pause")
        self.send_osc("/vdj", f"deck {deck} pause")

    def deck_sync(self, deck: int):
        self.send_osc(f"/vdj/deck/{deck}/sync")
        self.send_osc("/vdj", f"deck {deck} sync")

    # Mixer Controls
    def set_crossfader(self, value: float):
        val = max(0.0, min(1.0, float(value)))
        self.deck_state["crossfader"] = val
        self.send_osc("/vdj/crossfader", val)
        self.send_osc("/vdj", f"crossfader {int(val * 100)}%")

    def set_eq_low(self, deck: int, value: float):
        val = max(0.0, min(1.0, float(value)))
        self.deck_state[deck]["eq_low"] = val
        self.send_osc(f"/vdj/deck/{deck}/eq_low", val)
        self.send_osc("/vdj", f"deck {deck} eq_low {int(val * 100)}%")

    def set_eq_mid(self, deck: int, value: float):
        val = max(0.0, min(1.0, float(value)))
        self.deck_state[deck]["eq_mid"] = val
        self.send_osc(f"/vdj/deck/{deck}/eq_mid", val)
        self.send_osc("/vdj", f"deck {deck} eq_mid {int(val * 100)}%")

    def set_eq_high(self, deck: int, value: float):
        val = max(0.0, min(1.0, float(value)))
        self.deck_state[deck]["eq_high"] = val
        self.send_osc(f"/vdj/deck/{deck}/eq_high", val)
        self.send_osc("/vdj", f"deck {deck} eq_high {int(val * 100)}%")

    def set_filter(self, deck: int, value: float):
        val = max(0.0, min(1.0, float(value)))
        self.deck_state[deck]["filter"] = val
        self.send_osc(f"/vdj/deck/{deck}/filter", val)
        self.send_osc("/vdj", f"deck {deck} filter {int(val * 100)}%")

    def set_stem_vocal(self, deck: int, value: float):
        val = max(0.0, min(1.0, float(value)))
        self.deck_state[deck]["stem_vocal"] = val
        self.send_osc(f"/vdj/deck/{deck}/stem_vocal", val)
        self.send_osc("/vdj", f"deck {deck} stem_vocal {int(val * 100)}%")

    def set_stem_bass(self, deck: int, value: float):
        val = max(0.0, min(1.0, float(value)))
        self.deck_state[deck]["stem_bass"] = val
        self.send_osc(f"/vdj/deck/{deck}/stem_bass", val)
        self.send_osc("/vdj", f"deck {deck} stem_bass {int(val * 100)}%")

    def set_stem_instruments(self, deck: int, value: float):
        val = max(0.0, min(1.0, float(value)))
        self.deck_state[deck]["stem_instruments"] = val
        self.send_osc(f"/vdj/deck/{deck}/stem_instruments", val)
        self.send_osc("/vdj", f"deck {deck} stem 'instruments' {int(val * 100)}%")

    def set_stem_drums(self, deck: int, value: float):
        val = max(0.0, min(1.0, float(value)))
        self.deck_state[deck]["stem_drums"] = val
        self.send_osc(f"/vdj/deck/{deck}/stem_drums", val)
        self.send_osc("/vdj", f"deck {deck} stem 'drums' {int(val * 100)}%")

    def _osc_listen_loop(self):
        while self.running:
            if not self.udp_sock:
                time.sleep(0.5)
                continue
            try:
                data, _ = self.udp_sock.recvfrom(4096)
                address, args = parse_osc_message(data)
                if address:
                    self._handle_incoming_osc(address, args)
            except socket.timeout:
                continue
            except Exception:
                time.sleep(0.1)

    def _handle_incoming_osc(self, address: str, args):
        self.connected = True
        parts = address.strip("/").split("/")
        if len(parts) >= 4 and parts[0] == "vdj" and parts[1] == "deck":
            try:
                deck = int(parts[2])
                prop = parts[3]
                if prop == "get_bpm" and args:
                    self.deck_state[deck]["bpm"] = float(args[0])
                elif prop in ("songpos", "time_remaining") and args:
                    self.deck_state[deck]["time_remaining"] = float(args[0])
                elif prop == "get_key" and args:
                    self.deck_state[deck]["key"] = str(args[0])
                elif prop == "get_beat_pos" and args:
                    beat = int(args[0])
                    self.deck_state[deck]["beat_pos"] = beat
                    self.deck_state[deck]["phrase_pos"] = (beat - 1) % 32
            except (ValueError, IndexError):
                pass
