"""
Unit Tests for MIXMIND Harmonic Intelligence & Personalities
"""

import unittest
from backend.src.intelligence.camelot import normalize_to_camelot, get_harmonic_compatibility
from backend.src.intelligence.personalities import get_personality, MELODIC_DJ, FESTIVAL_DJ, CLUB_DJ


class TestHarmonicIntelligence(unittest.TestCase):
    def test_camelot_normalization(self):
        self.assertEqual(normalize_to_camelot("Am"), "8A")
        self.assertEqual(normalize_to_camelot("C"), "8B")
        self.assertEqual(normalize_to_camelot("8a"), "8A")
        self.assertEqual(normalize_to_camelot("11B"), "11B")
        self.assertEqual(normalize_to_camelot("D#m"), "2A")

    def test_harmonic_rules(self):
        comp, score, _ = get_harmonic_compatibility("8A", "8A")
        self.assertTrue(comp)
        self.assertEqual(score, 100)

        comp, score, _ = get_harmonic_compatibility("8A", "8B")
        self.assertTrue(comp)
        self.assertEqual(score, 95)

        comp, score, _ = get_harmonic_compatibility("8A", "9A")
        self.assertTrue(comp)
        self.assertEqual(score, 90)

        # Clash
        comp, score, _ = get_harmonic_compatibility("8A", "2A")
        self.assertFalse(comp)

    def test_dj_personality_scoring(self):
        current = {"bpm": 124.0, "camelot_key": "8A", "energy": 0.6}
        candidate_harmonic = {"filepath": "/h.mp3", "bpm": 124.5, "camelot_key": "8A", "energy": 0.7}
        candidate_clash = {"filepath": "/c.mp3", "bpm": 128.0, "camelot_key": "2A", "energy": 0.9}

        mel_score_h = MELODIC_DJ.score_track(current, candidate_harmonic, [])
        mel_score_c = MELODIC_DJ.score_track(current, candidate_clash, [])
        self.assertGreater(mel_score_h, mel_score_c)

        fest_score_c = FESTIVAL_DJ.score_track(current, candidate_clash, [])
        self.assertGreater(fest_score_c, mel_score_c)


if __name__ == "__main__":
    unittest.main()
