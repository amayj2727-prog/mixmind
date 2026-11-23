"""
MIXMIND - Live Mashup Engine & Real-Time Performance Combinator
Intelligently pairs compatible musical sections from local library tracks.
Coordinates 4-stem isolation (vocals over instrumental grooves), phrase alignment,
loop creation, and harmonic synchronization.

Strictly adheres to:
- Read-only audio access (never alters original files).
- No unauthorized external remix distribution.
- Execution gated by Copilot approval or validated Autopilot rules.
"""

import os
import uuid
import logging
from enum import Enum
from dataclasses import dataclass, asdict, field
from typing import Dict, Any, List, Optional, Tuple

from ..database.models import Track
from ..database.db import DatabaseManager
from ..intelligence.camelot import get_harmonic_compatibility
from ..dj_engine.modes import DJMode
from .stems import StemController, MockStemEngine

logger = logging.getLogger("LiveMashupEngine")


class MashupType(str, Enum):
    VOCAL_OVER_INSTRUMENTAL = "vocal_over_instrumental"  # Acapella lead over instrumental bed
    BREAKDOWN_VOCAL_HOOK = "breakdown_vocal_hook"        # 16-beat vocal hook looped over breakdown
    DRUM_OVER_MELODY = "drum_over_melody"                # Isolated percussion over melodic pad
    DROP_SWAP = "drop_swap"                              # Swapping drop basslines while keeping main lead


@dataclass
class LoopInstructions:
    deck: int
    loop_length_beats: int
    cue_seconds: float
    auto_release_beat: Optional[int] = None
    enabled: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class MashupProposal:
    """Structured proposal for an intentional, phrase-aligned live mashup."""
    proposal_id: str
    title: str
    mashup_type: MashupType
    base_track: Dict[str, Any]
    overlay_track: Dict[str, Any]
    base_deck: int
    overlay_deck: int
    target_bpm: float
    base_pitch_shift_pct: float
    overlay_pitch_shift_pct: float
    harmonic_relation: str
    harmonic_score: float
    base_stem_levels: Dict[str, float]
    overlay_stem_levels: Dict[str, float]
    loop_instructions: Optional[LoopInstructions]
    phrase_length_beats: int
    duration_beats: int
    compatibility_score: float
    confidence_score: float
    explanation: str
    approved: bool = False
    is_simulation: bool = True

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["mashup_type"] = self.mashup_type.value
        if self.loop_instructions:
            d["loop_instructions"] = self.loop_instructions.to_dict()
        return d


class LiveMashupEngine:
    def __init__(
        self,
        db: Optional[DatabaseManager] = None,
        stem_controller: Optional[StemController] = None
    ):
        self.db = db
        self.stem_controller = stem_controller or StemController()
        self.active_proposals: Dict[str, MashupProposal] = {}

    def search_mashup_candidates(
        self,
        current_track: Track,
        limit: int = 10
    ) -> List[Track]:
        """
        Searches the local library for candidate tracks that meet physical
        and musical criteria for mashup with the current track.
        """
        if not self.db:
            return []

        all_tracks = self.db.get_all_tracks()
        candidates: List[Track] = []

        curr_bpm = current_track.effective_bpm
        curr_key = current_track.effective_key

        for t in all_tracks:
            # Exclude self or duplicate
            if t.id == current_track.id or t.filepath == current_track.filepath:
                continue

            # Must physically exist on disk
            if not os.path.exists(t.filepath):
                continue

            # Skip corrupted tracks
            if t.scan_status == "error" or t.duration <= 10.0 or t.effective_bpm <= 0.0:
                continue

            # Tempo Window: pitch shift must not exceed 6.0% (or exact 2x/0.5x tempo)
            cand_bpm = t.effective_bpm
            bpm_ratio = cand_bpm / curr_bpm
            pitch_shift_direct = abs(cand_bpm - curr_bpm) / curr_bpm
            pitch_shift_double = abs(cand_bpm - curr_bpm * 2.0) / (curr_bpm * 2.0)
            pitch_shift_half = abs(cand_bpm - curr_bpm * 0.5) / (curr_bpm * 0.5)

            valid_tempo = (
                pitch_shift_direct <= 0.06 or
                pitch_shift_double <= 0.06 or
                pitch_shift_half <= 0.06
            )
            if not valid_tempo:
                continue

            # Harmonic compatibility: Camelot compatible
            cand_key = t.effective_key
            is_compat, score, _ = get_harmonic_compatibility(curr_key, cand_key)
            if not is_compat or score < 70:
                continue

            candidates.append(t)
            if len(candidates) >= limit * 2:
                break

        return candidates[:limit]

    def evaluate_mashup_pair(
        self,
        base_track: Track,
        candidate_track: Track
    ) -> Optional[MashupProposal]:
        """
        Evaluates a pair of tracks to produce a structured MashupProposal.
        Assigns roles (Vocal Lead vs Instrumental Bed), sets stem isolation,
        calculates pitch adjustments, loops, and generates confidence scores.
        """
        # Physical file verification
        if not os.path.exists(base_track.filepath) or not os.path.exists(candidate_track.filepath):
            return None

        # 1. Harmonic Analysis
        base_key = base_track.effective_key
        cand_key = candidate_track.effective_key
        harm_compat, harm_score, harm_relation = get_harmonic_compatibility(base_key, cand_key)

        if not harm_compat or harm_score < 70:
            return None

        # 2. Tempo Alignment
        base_bpm = base_track.effective_bpm
        cand_bpm = candidate_track.effective_bpm

        # Choose target BPM
        target_bpm = base_bpm  # Base track is currently playing on master deck
        cand_pitch_shift = round(((target_bpm - cand_bpm) / (cand_bpm + 1e-6)) * 100.0, 2)
        base_pitch_shift = 0.0

        if abs(cand_pitch_shift) > 6.0:
            return None

        # 3. Role Assignment (Vocal vs Instrumental)
        base_vocal = getattr(base_track, "vocal_presence", 0.5)
        cand_vocal = getattr(candidate_track, "vocal_presence", 0.5)

        # Decide which track provides vocals and which provides the instrumental groove
        if cand_vocal >= 0.50 and base_vocal < 0.40:
            # Candidate is vocal lead, base is groove bed
            vocal_track = candidate_track
            instrumental_track = base_track
            mashup_type = MashupType.VOCAL_OVER_INSTRUMENTAL
            base_stems = {"vocal": 0.0, "instruments": 1.0, "bass": 1.0, "drums": 1.0}
            overlay_stems = {"vocal": 1.0, "instruments": 0.0, "bass": 0.0, "drums": 0.0}
            role_expl = f"Layering {candidate_track.artist}'s vocal lead over {base_track.artist}'s instrumental groove."
        elif base_vocal >= 0.50 and cand_vocal < 0.40:
            # Base has vocals; candidate brings a fresh instrumental groove bed
            vocal_track = base_track
            instrumental_track = candidate_track
            mashup_type = MashupType.VOCAL_OVER_INSTRUMENTAL
            base_stems = {"vocal": 1.0, "instruments": 0.0, "bass": 0.0, "drums": 0.0}
            overlay_stems = {"vocal": 0.0, "instruments": 1.0, "bass": 1.0, "drums": 1.0}
            role_expl = f"Retaining {base_track.artist}'s vocals while swapping in {candidate_track.artist}'s instrumental bed."
        else:
            # Both have moderate vocals or both are electronic tracks: breakdown vocal hook
            vocal_track = candidate_track
            instrumental_track = base_track
            mashup_type = MashupType.BREAKDOWN_VOCAL_HOOK
            base_stems = {"vocal": 0.0, "instruments": 0.8, "bass": 1.0, "drums": 1.0}
            overlay_stems = {"vocal": 1.0, "instruments": 0.0, "bass": 0.0, "drums": 0.0}
            role_expl = f"Looping a 16-beat vocal hook from {candidate_track.title} over the main beat."

        # 4. Loop & Cue Setup
        loop_cue = candidate_track.effective_cue_in or 16.0
        loop_inst = LoopInstructions(
            deck=2,
            loop_length_beats=16,
            cue_seconds=round(loop_cue, 2),
            auto_release_beat=32,
            enabled=True
        )

        # 5. Composite Compatibility & Confidence
        tempo_penalty = abs(cand_pitch_shift) * 3.0  # Max 18% penalty for 6% shift
        key_score = harm_score                       # 70 to 100
        structural_fit = 90.0 if mashup_type == MashupType.VOCAL_OVER_INSTRUMENTAL else 80.0

        comp_score = round(max(0.0, (key_score * 0.40) + (structural_fit * 0.35) + ((100.0 - tempo_penalty) * 0.25)), 1)
        confidence = round(max(0.0, min(1.0, (comp_score / 100.0) - (0.05 if abs(cand_pitch_shift) > 3.0 else 0.0))), 2)

        proposal_id = str(uuid.uuid4())[:8]
        title = f"{candidate_track.title} (Acapella) × {base_track.title} (Groove)"

        explanation = (
            f"{role_expl} Harmonic relationship: {harm_relation} ({cand_key} over {base_key}). "
            f"Tempo locked at {target_bpm:.1f} BPM (pitch adjustment: {cand_pitch_shift:+.1f}%)."
        )

        proposal = MashupProposal(
            proposal_id=proposal_id,
            title=title,
            mashup_type=mashup_type,
            base_track=base_track.to_dict(),
            overlay_track=candidate_track.to_dict(),
            base_deck=1,
            overlay_deck=2,
            target_bpm=target_bpm,
            base_pitch_shift_pct=base_pitch_shift,
            overlay_pitch_shift_pct=cand_pitch_shift,
            harmonic_relation=harm_relation,
            harmonic_score=harm_score,
            base_stem_levels=base_stems,
            overlay_stem_levels=overlay_stems,
            loop_instructions=loop_inst,
            phrase_length_beats=32,
            duration_beats=32,
            compatibility_score=comp_score,
            confidence_score=confidence,
            explanation=explanation,
            approved=False,
            is_simulation=self.stem_controller.is_simulation
        )

        self.active_proposals[proposal_id] = proposal
        return proposal

    def get_live_mashup_suggestions(
        self,
        current_track: Track,
        limit: int = 3
    ) -> List[Dict[str, Any]]:
        """
        Main workflow method: searches library, evaluates compatibility,
        and returns ranked, human-readable mashup recommendations.
        """
        candidates = self.search_mashup_candidates(current_track, limit=limit * 3)
        proposals: List[MashupProposal] = []

        for cand in candidates:
            prop = self.evaluate_mashup_pair(current_track, cand)
            if prop and prop.confidence_score >= 0.65:
                proposals.append(prop)

        # Sort descending by compatibility score
        proposals.sort(key=lambda p: p.compatibility_score, reverse=True)
        top_proposals = proposals[:limit]

        return [p.to_dict() for p in top_proposals]

    def approve_proposal(self, proposal_id: str) -> bool:
        """User explicitly approves a mashup recommendation in Copilot/Manual mode."""
        if proposal_id in self.active_proposals:
            self.active_proposals[proposal_id].approved = True
            logger.info(f"Mashup proposal {proposal_id} approved by user.")
            return True
        return False

    def execute_mashup(
        self,
        proposal: MashupProposal,
        mode: DJMode = DJMode.COPILOT,
        force_approval: bool = False
    ) -> Dict[str, Any]:
        """
        Executes an intentional live mashup.
        Enforces execution gatekeeping:
        - In Copilot / Manual: Requires explicit approval.
        - In Autopilot: Requires confidence >= 0.70 and zero physical/musical errors.
        - Commands VirtualDJ stem controller to isolate vocal / instrumental parts.
        """
        # 1. Approval Gate
        if mode in (DJMode.COPILOT, DJMode.MANUAL) and not (proposal.approved or force_approval):
            return {
                "success": False,
                "error": "Execution blocked: Mashup requires explicit user approval in Copilot/Manual mode."
            }

        # 2. Autopilot Safety Rules
        if mode == DJMode.AUTOPILOT:
            if proposal.confidence_score < 0.70:
                return {
                    "success": False,
                    "error": f"Execution rejected: Autopilot confidence ({proposal.confidence_score}) below 0.70 threshold."
                }
            if abs(proposal.overlay_pitch_shift_pct) > 6.0:
                return {
                    "success": False,
                    "error": f"Execution rejected: Pitch shift ({proposal.overlay_pitch_shift_pct:.1f}%) exceeds safety limit."
                }

        # 3. Physical File Integrity Check (Must not modify original files)
        base_path = proposal.base_track.get("filepath", "")
        overlay_path = proposal.overlay_track.get("filepath", "")

        if not os.path.exists(base_path) or not os.path.exists(overlay_path):
            return {
                "success": False,
                "error": "Execution failed: Audio file missing on local disk."
            }

        # 4. Apply Stem Isolation & Deck Setup
        # Deck 1 (Base): apply stem isolation
        self.stem_controller.apply_stem_allocation(proposal.base_deck, proposal.base_stem_levels)

        # Deck 2 (Overlay): apply stem isolation
        self.stem_controller.apply_stem_allocation(proposal.overlay_deck, proposal.overlay_stem_levels)

        # Load & sync overlay deck if client is connected
        if self.stem_controller.client:
            self.stem_controller.client.deck_load(proposal.overlay_deck, overlay_path)
            self.stem_controller.client.deck_sync(proposal.overlay_deck)
            self.stem_controller.client.deck_play(proposal.overlay_deck)

        logger.info(f"Live mashup executed: {proposal.title} [Simulation: {self.stem_controller.is_simulation}]")

        return {
            "success": True,
            "proposal_id": proposal.proposal_id,
            "title": proposal.title,
            "is_simulation": self.stem_controller.is_simulation,
            "stem_status": {
                f"deck_{proposal.base_deck}": proposal.base_stem_levels,
                f"deck_{proposal.overlay_deck}": proposal.overlay_stem_levels
            },
            "explanation": proposal.explanation
        }
