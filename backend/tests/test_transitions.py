"""
Unit Tests for Transition State Machine & Mathematical Curves
"""

import unittest
from backend.src.transitions.state_machine import TransitionStateMachine, TransitionState
from backend.src.transitions.curves import linear_curve, filter_sweep_curve
from backend.src.virtualdj.client import VirtualDJClient
from backend.src.database.models import Track


class TestTransitions(unittest.TestCase):
    def setUp(self):
        self.client = VirtualDJClient()
        self.state_machine = TransitionStateMachine(client=self.client)

    def tearDown(self):
        self.client.stop()

    def test_curves(self):
        self.assertAlmostEqual(linear_curve(0.5, 0.0, 1.0), 0.5)
        self.assertGreater(filter_sweep_curve(0.8, 0.5, 0.8), 0.5)

    def test_state_machine_execution(self):
        t1 = Track(filepath="/t1.mp3", filename="t1.mp3", file_hash="h1", title="Track 1", artist="Artist 1")
        t2 = Track(filepath="/t2.mp3", filename="t2.mp3", file_hash="h2", title="Track 2", artist="Artist 2")

        self.state_machine.start_playback(t1)
        self.assertEqual(self.state_machine.state, TransitionState.MONITORING)

        self.state_machine.prepare_incoming(t2)
        self.assertEqual(self.state_machine.state, TransitionState.PREPARING)
        self.assertEqual(self.client.deck_state[2]["eq_low"], 0.0)  # Incoming bass killed

        self.state_machine.launch_transition()
        self.assertEqual(self.state_machine.state, TransitionState.INTRO_BLEND)

        # Intro blend (16 beats)
        for b in range(16):
            self.state_machine.tick(b, 124.0)
        self.assertEqual(self.state_machine.state, TransitionState.BUILDUP)

        # Buildup (15 beats)
        for b in range(16, 31):
            self.state_machine.tick(b, 124.0)
        self.assertEqual(self.state_machine.state, TransitionState.THE_DROP)

        # Drop: snap downbeat swap
        self.state_machine.tick(31, 124.0)
        self.assertEqual(self.state_machine.state, TransitionState.OUTRO_FADE)
        self.assertEqual(self.client.deck_state[1]["eq_low"], 0.0)
        self.assertEqual(self.client.deck_state[2]["eq_low"], 1.0)


if __name__ == "__main__":
    unittest.main()
