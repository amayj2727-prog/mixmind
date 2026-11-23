"""
MIXMIND - Harmonic Camelot Engine
Normalizes standard musical keys to Camelot Wheel and evaluates harmonic blending.
"""

import re
from typing import Tuple

KEY_TO_CAMELOT = {
    # Minor keys (A)
    "ABM": "1A", "G#M": "1A",
    "EBM": "2A", "D#M": "2A",
    "BBM": "3A", "A#M": "3A",
    "FM": "4A",
    "CM": "5A",
    "GM": "6A",
    "DM": "7A",
    "AM": "8A",
    "EM": "9A",
    "BM": "10A",
    "F#M": "11A", "GBM": "11A",
    "C#M": "12A", "DBM": "12A",

    # Major keys (B)
    "B": "1B",
    "F#": "2B", "GB": "2B",
    "DB": "3B", "C#": "3B",
    "AB": "4B", "G#": "4B",
    "EB": "5B", "D#": "5B",
    "BB": "6B", "A#": "6B",
    "F": "7B",
    "C": "8B",
    "G": "9B",
    "D": "10B",
    "A": "11B",
    "E": "12B",
}


def normalize_to_camelot(key_str: str) -> str:
    """Normalizes any musical key string to Camelot format (e.g. '8A')."""
    if not key_str:
        return "8A"
    clean = key_str.strip().upper().replace(" ", "").replace("MIN", "M").replace("MAJ", "")

    # Already Camelot format (e.g. 8A, 11B)
    match = re.match(r"^(\d{1,2})([AB])$", clean)
    if match:
        num = int(match.group(1))
        letter = match.group(2)
        if 1 <= num <= 12:
            return f"{num}{letter}"

    if clean in KEY_TO_CAMELOT:
        return KEY_TO_CAMELOT[clean]

    clean = clean.replace("MINOR", "M").replace("MAJOR", "")
    if clean in KEY_TO_CAMELOT:
        return KEY_TO_CAMELOT[clean]

    return "8A"


def get_harmonic_compatibility(key1: str, key2: str) -> Tuple[bool, int, str]:
    """
    Evaluates harmonic compatibility between two keys.
    Returns: (is_compatible: bool, score: int, relation: str)
    """
    c1 = normalize_to_camelot(key1)
    c2 = normalize_to_camelot(key2)

    num1 = int(c1[:-1])
    let1 = c1[-1]

    num2 = int(c2[:-1])
    let2 = c2[-1]

    # 1. Exact Match
    if c1 == c2:
        return True, 100, "Perfect Match (Same Key)"

    # 2. Relative Major/Minor
    if num1 == num2 and let1 != let2:
        return True, 95, "Relative Major/Minor (Harmonic Shift)"

    # 3. Adjacent Wheel Step (+/- 1)
    diff = abs(num1 - num2)
    is_adjacent = (diff == 1) or (diff == 11)
    if is_adjacent and let1 == let2:
        return True, 90, "Smooth Adjacent Blend (+/- 1 on Wheel)"

    # 4. Diagonal Jump
    if is_adjacent and let1 != let2:
        return True, 75, "Diagonal Step (Mood Modulation)"

    # 5. Energy Boost (+2 on wheel)
    if (num2 - num1) % 12 == 2 and let1 == let2:
        return True, 70, "Energy Boost (+2 Camelot Step)"

    # Harmonic Clash
    return False, 30, "Harmonic Clash"
