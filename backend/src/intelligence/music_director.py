"""
MIXMIND - AI Music Director Engine
Autonomous and Copilot track selection orchestrator.
Evaluates candidates using deterministic music-theoretic scoring, harmonic rules,
repetition prevention, energy curves, genre clustering, and adaptive rejection feedback.
"""

import os
import time
import logging
from typing import List, Dict, Any, Optional, Set

from ..database.db import DatabaseManager
from ..database.models import Track
from .camelot import get_harmonic_compatibility, normalize_to_camelot
from .personalities import DJPersonality, get_personality
from .genre_matrix import get_genre_compatibility
from .explanation import ExplanationGenerator, SelectionExplanation

logger = logging.getLogger("MusicDirector")


class EnergyPhase:
    BUILD = "BUILD"          # Escalating crowd energy (+0.05 to +0.20)
    MAINTAIN = "MAINTAIN"    # Locking steady hypnosis (|dE| <= 0.08)
    PEAK = "PEAK"            # Driving highest intensity (0.85 - 1.0)
    RESET = "RESET"          # Post-peak breakdown / breathing space (-0.25 to -0.40)
    COOLDOWN = "COOLDOWN"    # Gradual wind-down (-0.10)


class MusicDirector:
    def __init__(
        self,
        db: DatabaseManager,
        personality_id: str = "club",
        repetition_cooldown: int = 15,
        artist_cooldown: int = 4
    ):
        self.db = db
        self.personality: DJPersonality = get_personality(personality_id)
        self.repetition_cooldown = repetition_cooldown
        self.artist_cooldown = artist_cooldown

        # Session State
        self.history: List[Track] = []                  # In-order playback history
        self.rejected_track_ids: Set[int] = set()       # Explicitly rejected in this session
        self.rejected_artists: Dict[str, int] = {}      # Artist rejection count
        self.rejected_genres: Dict[str, int] = {}       # Genre rejection count
        self.current_energy_phase = EnergyPhase.BUILD
        self.target_genre: Optional[str] = None
        self.manual_energy_target: Optional[float] = None

    def set_personality(self, personality_id: str):
        self.personality = get_personality(personality_id)
        logger.info(f"Music Director personality updated to: {self.personality.name}")

    def set_energy_phase(self, phase: str):
        self.current_energy_phase = phase
        logger.info(f"Music Director energy phase set to: {phase}")

    def set_target_genre(self, genre: Optional[str]):
        self.target_genre = genre
        logger.info(f"Music Director target genre set to: {genre}")

    def record_played(self, track: Track):
        """Records a track as played in the active session."""
        self.history.append(track)
        if track.id:
            self.db.record_playback(track.id)
        logger.info(f"Recorded playback in session history: {track.artist} - {track.title}")

    def reject_recommendation(self, track_id: int, reason: str = ""):
        """
        User rejects a recommended track.
        Adapts the recommendation model by penalizing the track, artist, and genre.
        """
        track = self.db.get_track_by_id(track_id)
        if not track:
            return

        self.rejected_track_ids.add(track_id)

        artist_norm = track.artist.strip().lower()
        self.rejected_artists[artist_norm] = self.rejected_artists.get(artist_norm, 0) + 1

        genre_norm = track.genre.strip().lower()
        self.rejected_genres[genre_norm] = self.rejected_genres.get(genre_norm, 0) + 1

        logger.info(
            f"User rejected recommendation: '{track.title}' by {track.artist} (Reason: {reason or 'Not specified'}). "
            f"Adapted session negative weights."
        )

    def recommend_next_tracks(
        self,
        current_track: Track,
        limit: int = 5,
        exclude_paths: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Evaluates candidate tracks from the library using deterministic music logic.
        Returns a sorted list of candidate recommendations with scores and explanations.
        """
        all_candidates = self.db.get_all_tracks()
        excluded = set(exclude_paths or [])

        # Filter out invalid, missing, or rejected tracks
        valid_candidates = []
        for cand in all_candidates:
            # 1. Local availability check (Strict Requirement: Never select missing files)
            if not os.path.exists(cand.filepath):
                continue

            # 2. Skip the currently playing track
            if cand.filepath == current_track.filepath:
                continue

            # 3. Skip corrupted or invalid files
            if cand.scan_status == "error" or cand.effective_bpm <= 0.0:
                continue

            # 4. Skip duplicate audio files (always recommend primary copies)
            if cand.is_duplicate:
                continue

            # 5. Skip explicitly excluded paths
            if cand.filepath in excluded:
                continue

            # 6. Skip tracks explicitly rejected in this session
            if cand.id in self.rejected_track_ids:
                continue

            valid_candidates.append(cand)

        if not valid_candidates:
            logger.warning("No eligible candidate tracks available in library!")
            return []

        # Score all valid candidates
        scored_candidates = []
        for cand in valid_candidates:
            score_data = self._evaluate_candidate(current_track, cand)
            if score_data["score"] > -500:  # Valid score threshold
                scored_candidates.append(score_data)

        # Sort descending by composite score
        scored_candidates.sort(key=lambda x: x["score"], reverse=True)
        return scored_candidates[:limit]

    def _evaluate_candidate(self, current: Track, candidate: Track) -> Dict[str, Any]:
        """
        Evaluates a candidate track against the current playing track.
        Returns composite score, sub-scores, and human-readable explanation.
        """
        curr_bpm = current.effective_bpm
        cand_bpm = candidate.effective_bpm
        curr_key = current.effective_key
        cand_key = candidate.effective_key
        curr_energy = current.energy
        cand_energy = candidate.energy
        cand_genre = candidate.genre
        cand_vocal = candidate.vocal_presence if hasattr(candidate, "vocal_presence") else 0.5

        scores: Dict[str, float] = {}

        # ----------------------------------------------------
        # 1. Harmonic Score (0 - 100 base)
        # ----------------------------------------------------
        compatible, harm_points, relation = get_harmonic_compatibility(curr_key, cand_key)
        strictness = self.personality.harmonic_strictness

        if compatible:
            scores["harmonic"] = harm_points * strictness
        else:
            scores["harmonic"] = -((100.0 - harm_points) * strictness * 1.5)

        # ----------------------------------------------------
        # 2. Tempo Alignment Score
        # ----------------------------------------------------
        bpm_diff = abs(cand_bpm - curr_bpm)
        max_jump = self.personality.max_bpm_jump

        if bpm_diff <= 0.2:
            scores["tempo"] = 25.0  # Perfect beat match bonus
        elif bpm_diff <= max_jump:
            scores["tempo"] = 25.0 - (bpm_diff * 4.0)
        else:
            scores["tempo"] = -((bpm_diff - max_jump) * 20.0)

        # ----------------------------------------------------
        # 3. Energy Progression Score
        # ----------------------------------------------------
        energy_diff = cand_energy - curr_energy
        phase = self.current_energy_phase

        if self.manual_energy_target is not None:
            # User manually locked target energy level
            target_diff = abs(cand_energy - self.manual_energy_target)
            scores["energy"] = 30.0 * (1.0 - target_diff * 2.0)

        elif phase == EnergyPhase.BUILD:
            # Favors gradual climb (+0.05 to +0.20)
            if 0.04 <= energy_diff <= 0.22:
                scores["energy"] = 30.0
            elif energy_diff > 0.22:
                scores["energy"] = 15.0 - (energy_diff * 10.0)  # Too abrupt
            else:
                scores["energy"] = -abs(energy_diff) * 25.0    # Opposing energy build

        elif phase == EnergyPhase.MAINTAIN:
            # Favors steady hypnotic groove (|dE| <= 0.08)
            scores["energy"] = 30.0 - (abs(energy_diff) * 40.0)

        elif phase == EnergyPhase.RESET:
            # Favors breakdown/breathing room drop (-0.15 to -0.35)
            if -0.35 <= energy_diff <= -0.10:
                scores["energy"] = 30.0
            else:
                scores["energy"] = -abs(energy_diff) * 20.0

        elif phase == EnergyPhase.PEAK:
            # Favors highest energy ceiling
            scores["energy"] = 30.0 * cand_energy

        else:
            scores["energy"] = 20.0 - (abs(energy_diff) * 20.0)

        # ----------------------------------------------------
        # 4. Genre Compatibility Score
        # ----------------------------------------------------
        if self.target_genre:
            genre_compat = get_genre_compatibility(self.target_genre, cand_genre)
            scores["genre"] = 25.0 * genre_compat
        else:
            genre_compat = get_genre_compatibility(current.genre, cand_genre)
            scores["genre"] = 20.0 * genre_compat

        # ----------------------------------------------------
        # 5. Vocal Density & Clashing Avoidance
        # ----------------------------------------------------
        curr_vocal = current.vocal_presence if hasattr(current, "vocal_presence") else 0.5
        if curr_vocal > 0.60 and cand_vocal > 0.60:
            # Two heavy vocal tracks back-to-back: penalize lyric collision
            scores["vocal"] = -15.0
        elif curr_vocal > 0.50 and cand_vocal < 0.30:
            # Vocal followed by instrumental groove: smooth DJ blend
            scores["vocal"] = 10.0
        else:
            scores["vocal"] = 5.0

        # ----------------------------------------------------
        # 6. Repetition Avoidance (Track & Artist Cooldown)
        # ----------------------------------------------------
        history_paths = [t.filepath for t in self.history[-self.repetition_cooldown:]]
        if candidate.filepath in history_paths:
            # Track played too recently
            idx_from_end = len(history_paths) - history_paths.index(candidate.filepath)
            scores["repetition"] = -300.0 / idx_from_end
        else:
            scores["repetition"] = 10.0

        # Artist Spacing
        recent_artists = [t.artist.strip().lower() for t in self.history[-self.artist_cooldown:]]
        cand_artist_norm = candidate.artist.strip().lower()
        if cand_artist_norm in recent_artists:
            recency = self.artist_cooldown - recent_artists[::-1].index(cand_artist_norm)
            scores["artist_fatigue"] = -(35.0 / recency)
        else:
            scores["artist_fatigue"] = 5.0

        # ----------------------------------------------------
        # 7. Adaptive Rejection Feedback Modifiers
        # ----------------------------------------------------
        feedback_penalty = 0.0
        if cand_artist_norm in self.rejected_artists:
            feedback_penalty += self.rejected_artists[cand_artist_norm] * 20.0

        cand_genre_norm = candidate.genre.strip().lower()
        if cand_genre_norm in self.rejected_genres:
            feedback_penalty += self.rejected_genres[cand_genre_norm] * 12.0

        scores["rejection_feedback"] = -feedback_penalty

        # ----------------------------------------------------
        # Total Composite Calculation
        # ----------------------------------------------------
        total_score = sum(scores.values())
        scores["total"] = round(total_score, 1)

        # Generate human-readable explanation
        explanation = ExplanationGenerator.generate(
            current_track=current.to_dict(),
            candidate_track=candidate.to_dict(),
            scores=scores,
            harmonic_relation=relation,
            energy_phase=phase
        )

        return {
            "track": candidate,
            "score": round(total_score, 1),
            "sub_scores": {k: round(v, 1) for k, v in scores.items()},
            "harmonic_relation": relation,
            "explanation": explanation,
            "bpm_diff": round(cand_bpm - curr_bpm, 1),
            "energy_diff": round(cand_energy - curr_energy, 2)
        }
