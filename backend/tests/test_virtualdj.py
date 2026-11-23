"""
Unit Tests for MIXMIND VirtualDJ Protocol, Client, and Modular Adapter Architecture
Tests:
- MockVirtualDJAdapter vs RealVirtualDJAdapter
- Connection status lifecycles & license restriction flags
- Track information and deck state retrieval
- Validated track loading, playback, loops, and transition steps
- Command validation and rejection of out-of-bounds parameters
- Manual takeover arbitration (locks out AI automation while active)
- Error recovery and retry policies
"""

import os
import tempfile
import unittest

from backend.src.virtualdj.osc_protocol import build_osc_message, parse_osc_message
from backend.src.virtualdj.client import VirtualDJClient
from backend.src.virtualdj.adapter import (
    MockVirtualDJAdapter,
    RealVirtualDJAdapter,
    IVirtualDJAdapter,
    ConnectionStatus,
    DeckState,
    TrackInfo,
    CommandValidator,
    get_virtualdj_adapter
)


class TestVirtualDJProtocol(unittest.TestCase):
    def test_osc_encoding_decoding(self):
        # Float payload
        encoded = build_osc_message("/vdj/crossfader", 0.75)
        addr, args = parse_osc_message(encoded)
        self.assertEqual(addr, "/vdj/crossfader")
        self.assertEqual(len(args), 1)
        self.assertAlmostEqual(args[0], 0.75, places=4)

        # String payload
        encoded_str = build_osc_message("/vdj/deck/1/load", "/path/to/song.mp3")
        addr, args = parse_osc_message(encoded_str)
        self.assertEqual(addr, "/vdj/deck/1/load")
        self.assertEqual(args[0], "/path/to/song.mp3")

    def test_client_mixer_state(self):
        client = VirtualDJClient()
        client.set_crossfader(0.4)
        self.assertEqual(client.deck_state["crossfader"], 0.4)

        client.set_eq_low(1, 0.0)
        self.assertEqual(client.deck_state[1]["eq_low"], 0.0)

        client.set_filter(2, 0.8)
        self.assertEqual(client.deck_state[2]["filter"], 0.8)

        client.stop()


class TestVirtualDJAdapterArchitecture(unittest.TestCase):
    def setUp(self):
        self.tmp_dir = tempfile.TemporaryDirectory()
        self.dummy_audio = os.path.join(self.tmp_dir.name, "anthem.mp3")
        with open(self.dummy_audio, "wb") as f:
            f.write(b"ID3dummydata12345")

        self.mock_adapter = MockVirtualDJAdapter()

    def tearDown(self):
        self.tmp_dir.cleanup()

    def test_connection_status_and_simulation_flag(self):
        """Verifies initial connection status, simulation flag, and disconnection."""
        self.assertTrue(self.mock_adapter.is_simulation)
        self.assertTrue(self.mock_adapter.is_connected)
        self.assertEqual(self.mock_adapter.status, ConnectionStatus.CONNECTED)

        self.mock_adapter.disconnect()
        self.assertFalse(self.mock_adapter.is_connected)
        self.assertEqual(self.mock_adapter.status, ConnectionStatus.DISCONNECTED)

    def test_track_loading_and_info_retrieval(self):
        """Verifies track loading, validation, and metadata extraction."""
        # Valid track load
        success = self.mock_adapter.load_track(1, self.dummy_audio)
        self.assertTrue(success)

        # Retrieve deck state and track info
        state = self.mock_adapter.get_deck_state(1)
        self.assertEqual(state.title, "anthem")
        self.assertEqual(state.filepath, self.dummy_audio)
        self.assertFalse(state.playing)

        info = self.mock_adapter.get_track_info(1)
        self.assertIsNotNone(info)
        self.assertEqual(info.title, "anthem")
        self.assertEqual(info.bpm, 124.0)

        # Non-existent track load -> MUST FAIL validation
        bad_load = self.mock_adapter.load_track(1, "/ghost/nonexistent_audio.mp3")
        self.assertFalse(bad_load)

    def test_playback_and_transport_controls(self):
        """Verifies play, pause, stop, sync, cue, and loop controls."""
        self.mock_adapter.load_track(1, self.dummy_audio)

        # Play
        self.mock_adapter.play(1)
        self.assertTrue(self.mock_adapter.get_deck_state(1).playing)

        # Pause
        self.mock_adapter.pause(1)
        self.assertFalse(self.mock_adapter.get_deck_state(1).playing)

        # Play -> Stop
        self.mock_adapter.play(1)
        self.mock_adapter.stop(1)
        st = self.mock_adapter.get_deck_state(1)
        self.assertFalse(st.playing)
        self.assertEqual(st.time_elapsed, 0.0)

        # Sync
        self.mock_adapter.decks[2].bpm = 130.0
        self.mock_adapter.sync(1)
        self.assertEqual(self.mock_adapter.get_deck_state(1).bpm, 130.0)

        # Loop Set & Exit
        self.mock_adapter.set_loop(1, 16)
        st_loop = self.mock_adapter.get_deck_state(1)
        self.assertTrue(st_loop.loop_active)
        self.assertEqual(st_loop.loop_length_beats, 16)

        self.mock_adapter.exit_loop(1)
        self.assertFalse(self.mock_adapter.get_deck_state(1).loop_active)

    def test_mixer_and_4_stem_controls(self):
        """Verifies crossfader, 3-band EQ, dual-mode filter, and 4-stem isolation."""
        # Crossfader
        self.mock_adapter.set_crossfader(0.75)
        self.assertEqual(self.mock_adapter.crossfader, 0.75)

        # EQ
        self.mock_adapter.set_eq(1, low=0.0, mid=0.9, high=1.2)
        st = self.mock_adapter.get_deck_state(1)
        self.assertEqual(st.eq_low, 0.0)
        self.assertEqual(st.eq_mid, 0.9)
        self.assertEqual(st.eq_high, 1.2)

        # Filter (HPF sweep)
        self.mock_adapter.set_filter(1, 0.85)
        self.assertEqual(self.mock_adapter.get_deck_state(1).filter_val, 0.85)

        # Stems
        self.mock_adapter.set_stem(1, "vocal", 0.0)
        self.mock_adapter.set_stem(1, "bass", 0.5)
        stems = self.mock_adapter.get_deck_state(1).stems
        self.assertEqual(stems["vocal"], 0.0)
        self.assertEqual(stems["bass"], 0.5)
        self.assertEqual(stems["drums"], 1.0)
        self.assertEqual(stems["instruments"], 1.0)

        # Solo vocal
        self.mock_adapter.solo_stem(2, "vocal")
        stems2 = self.mock_adapter.get_deck_state(2).stems
        self.assertEqual(stems2["vocal"], 1.0)
        self.assertEqual(stems2["drums"], 0.0)
        self.assertEqual(stems2["bass"], 0.0)

    def test_transition_step_execution(self):
        """Verifies atomic execution of a multi-parameter transition frame."""
        res = self.mock_adapter.execute_transition_step(
            outgoing_deck=1,
            incoming_deck=2,
            crossfader=0.60,
            outgoing_eq=(0.0, 0.7, 0.8),
            incoming_eq=(1.0, 1.0, 1.0),
            outgoing_filter=0.75,
            incoming_filter=0.50
        )
        self.assertTrue(res)
        self.assertEqual(self.mock_adapter.crossfader, 0.60)
        self.assertEqual(self.mock_adapter.get_deck_state(1).eq_low, 0.0)
        self.assertEqual(self.mock_adapter.get_deck_state(1).filter_val, 0.75)
        self.assertEqual(self.mock_adapter.get_deck_state(2).eq_low, 1.0)

    def test_manual_takeover_arbitration(self):
        """Crucial Requirement: When DJ takes manual control, automated commands are blocked."""
        self.mock_adapter.load_track(1, self.dummy_audio)
        self.assertFalse(self.mock_adapter.manual_takeover_active)

        # Enable manual takeover
        self.mock_adapter.enable_manual_takeover(reason="DJ adjusting mixer knobs manually")
        self.assertTrue(self.mock_adapter.manual_takeover_active)

        # Automated playback attempt must be REJECTED
        play_res = self.mock_adapter.play(1)
        self.assertFalse(play_res)
        self.assertFalse(self.mock_adapter.get_deck_state(1).playing)

        # Automated crossfader attempt must be REJECTED
        fade_res = self.mock_adapter.set_crossfader(0.99)
        self.assertFalse(fade_res)

        # Automated transition step must be REJECTED
        step_res = self.mock_adapter.execute_transition_step(1, 2, 0.5)
        self.assertFalse(step_res)

        # Disable manual takeover -> Commands succeed again
        self.mock_adapter.disable_manual_takeover()
        self.assertFalse(self.mock_adapter.manual_takeover_active)

        play_res_restored = self.mock_adapter.play(1)
        self.assertTrue(play_res_restored)
        self.assertTrue(self.mock_adapter.get_deck_state(1).playing)

    def test_command_validation_bounds(self):
        """Verifies CommandValidator clamps and rejects invalid inputs."""
        # Faders clamp to [0.0, 1.0]
        self.assertEqual(CommandValidator.validate_fader(-0.5), 0.0)
        self.assertEqual(CommandValidator.validate_fader(1.5), 1.0)

        # EQ clamps to [0.0, 2.0]
        self.assertEqual(CommandValidator.validate_eq(-1.0), 0.0)
        self.assertEqual(CommandValidator.validate_eq(3.5), 2.0)

        # Deck validity
        self.assertTrue(CommandValidator.validate_deck(1))
        self.assertTrue(CommandValidator.validate_deck(4))
        self.assertFalse(CommandValidator.validate_deck(0))
        self.assertFalse(CommandValidator.validate_deck(5))

    def test_real_adapter_license_restriction_handling(self):
        """
        Verifies that RealVirtualDJAdapter does not crash or execute unvetted hacks
        when VirtualDJ Pro license is not present.
        """
        real_adapter = RealVirtualDJAdapter(host="127.0.0.1", osc_port=8000)
        self.assertFalse(real_adapter.is_simulation)

        # When connection is license restricted, commands return False safely
        real_adapter._status = ConnectionStatus.LICENSE_RESTRICTED
        self.assertEqual(real_adapter.status, ConnectionStatus.LICENSE_RESTRICTED)

        # Commands must cleanly reject without crashing or hanging
        res = real_adapter.play(1)
        self.assertFalse(res)

        fade_res = real_adapter.set_crossfader(0.5)
        self.assertFalse(fade_res)
        real_adapter.disconnect()


if __name__ == "__main__":
    unittest.main()
