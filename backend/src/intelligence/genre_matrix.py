"""
MIXMIND - Genre & Mood Compatibility Matrix
Determines natural transitions between electronic, dance, and crossover musical styles.
"""

from typing import Dict, Set

# Genre compatibility clusters (bidirectional affinity)
GENRE_CLUSTERS: Dict[str, Set[str]] = {
    "house": {"deep house", "tech house", "progressive house", "melodic house", "electro house", "afro house", "dance", "electronic"},
    "deep house": {"house", "melodic house", "progressive house", "afro house", "lounge", "electronic"},
    "tech house": {"house", "techno", "minimal techno", "deep tech", "bass house"},
    "progressive house": {"house", "melodic house", "trance", "deep house", "melodic techno"},
    "melodic house": {"progressive house", "deep house", "melodic techno", "house", "ambient"},
    "techno": {"tech house", "minimal techno", "melodic techno", "peak time techno", "acid"},
    "melodic techno": {"techno", "progressive house", "melodic house", "trance"},
    "trance": {"progressive house", "melodic techno", "psytrance", "electronic"},
    "bass house": {"tech house", "house", "electro house", "edm"},
    "afro house": {"house", "deep house", "tribal house", "latin house"},
    "edm": {"festival house", "electro house", "dance", "pop dance", "bass house"},
    "dance": {"house", "pop dance", "edm", "electronic", "club"},
    "commercial": {"dance", "pop dance", "edm", "house", "club"},
}


def normalize_genre(genre_str: str) -> str:
    if not genre_str:
        return "house"
    return genre_str.strip().lower()


def get_genre_compatibility(genre1: str, genre2: str) -> float:
    """
    Returns genre compatibility multiplier between 0.0 and 1.0.
    - 1.0: Identical genre
    - 0.85: Same stylistic cluster
    - 0.50: Compatible crossover
    - 0.20: Distant / abrupt genre shift
    """
    g1 = normalize_genre(genre1)
    g2 = normalize_genre(genre2)

    # Identical
    if g1 == g2:
        return 1.0

    # Direct cluster match
    cluster1 = GENRE_CLUSTERS.get(g1, set())
    if g2 in cluster1:
        return 0.85

    # Reverse cluster match
    cluster2 = GENRE_CLUSTERS.get(g2, set())
    if g1 in cluster2:
        return 0.85

    # Check for keyword overlap (e.g. "tech" in both "tech house" and "techno")
    words1 = set(g1.split())
    words2 = set(g2.split())
    if words1.intersection(words2):
        return 0.70

    return 0.25
