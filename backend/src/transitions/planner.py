"""
MIXMIND - DJ Performance Planner & Structured Transition Architect
Plans continuous, phrase-aligned musical performances.
Generates comprehensive, multi-dimensional transition plans without executing them.
Enforces strict validation rules: never permits unvalidated transitions.
"""

import os
import math
import logging
from enum import Enum
from dataclasses import dataclass, asdict, field
from typing import Dict, Any, List, Optional, Tuple

from ..database.models import Track
from ..intelligence.camelot import get_harmonic_compatibility, normalize_to_camelot
from ..intelligence.personalities import DJPersonality, get_personality

logger = logging.getLogger("PerformancePlanner")


class TransitionStyle(str, Enum):
    SMOOTH_BLEND = "smooth_blend"           # Classic 32-beat mid/high blend with downbeat bass swap
    EXTENDED_MIX = "extended_mix"           # Long 64-beat layered mix for melodic/deep sets
    ECHO_OUT = "echo_out"                   # Echo freeze / wash-out for wide BPM jumps or genre shifts
    LOOP_BASED = "loop_based"               # 4 or 8-beat loop locked on intro or breakdown
    VOCAL_OVERLAY = "vocal_overlay"         # Vocal stem active over instrumental bed
    BUILDUP_DROP = "buildup_drop"           # High-pass filter buildup into massive downbeat drop


@dataclass
class StemInstructions:
    outgoing_stems: Dict[str, float]        # {"vocal": 1.0, "bass": 0.0, "drums": 0.8, "instruments": 0.5}
    incoming_stems: Dict[str, float]        # {"vocal": 1.0, "bass": 1.0, "drums": 1.0, "instruments": 1.0}
    vocal_overlay_active: bool = False
    instrumental_overlay_active: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class EQInstructions:
    low_strategy: str                       # "instant_downbeat", "gradual_crossfade", "frequency_split"
    outgoing_low_curve: str                 # "cut_at_beat_32", "linear_decay", "hpf_thin"
    incoming_low_curve: str                 # "muted_until_drop", "linear_rise"
    mid_crossfade_curve: str                # "linear", "s_curve"
    high_crossfade_curve: str               # "linear", "s_curve"
    bass_swap_beat: int = 32

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class EffectsInstructions:
    primary_effect: str                     # "filter_hpf", "echo_freeze", "reverb_wash", "loop_roll", "none"
    filter_max: float = 0.75                # Max high-pass filter frequency (0.5 = neutral, 1.0 = full cut)
    echo_beats: Optional[float] = None      # 0.5, 0.75 (3/4 dotted), 1.0 beat delay
    reverb_wet_level: float = 0.0
    start_beat: int = 16
    peak_beat: int = 31

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class ValidationResult:
    is_valid: bool
    confidence_score: float                 # 0.0 to 1.0
    validation_errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class StructuredTransitionPlan:
    """The 10-point structured transition blueprint consumed by MIXMIND."""
    # 1. Tracks
    current_track: Dict[str, Any]
    incoming_track: Dict[str, Any]

    # 2. Timing
    transition_style: TransitionStyle
    recommended_transition_start: float     # Seconds into current track
    transition_start_phrase_beat: int       # Beat in phrase (e.g. beat 0 of 32)
    duration_beats: int                     # 16, 32, 64 beats
    duration_seconds: float                 # Exact duration in seconds at target BPM

    # 3. Tempo
    target_bpm: float
    current_pitch_shift_pct: float          # e.g. +0.8%
    incoming_pitch_shift_pct: float         # e.g. -0.8%

    # 4. Harmonic & Key
    key_compatibility: Dict[str, Any]

    # 5. Phrase Alignment
    phrase_compatibility: Dict[str, Any]

    # 6. Stems
    stem_requirements: StemInstructions

    # 7. EQ Instructions
    eq_instructions: EQInstructions

    # 8. Effects
    effects_instructions: EffectsInstructions

    # 9. Loop Opportunities
    loop_opportunity: Optional[Dict[str, Any]] = None

    # 10. Validation & Confidence
    validation: ValidationResult = field(default_factory=lambda: ValidationResult(is_valid=False, confidence_score=0.0))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "current_track": self.current_track,
            "incoming_track": self.incoming_track,
            "transition_style": self.transition_style.value,
            "recommended_transition_start": self.recommended_transition_start,
            "transition_start_phrase_beat": self.transition_start_phrase_beat,
            "duration_beats": self.duration_beats,
            "duration_seconds": self.duration_seconds,
            "target_bpm": self.target_bpm,
            "current_pitch_shift_pct": self.current_pitch_shift_pct,
            "incoming_pitch_shift_pct": self.incoming_pitch_shift_pct,
            "key_compatibility": self.key_compatibility,
            "phrase_compatibility": self.phrase_compatibility,
            "stem_requirements": self.stem_requirements.to_dict(),
            "eq_instructions": self.eq_instructions.to_dict(),
            "effects_instructions": self.effects_instructions.to_dict(),
            "loop_opportunity": self.loop_opportunity,
            "validation": self.validation.to_dict(),
            "confidence_score": self.validation.confidence_score,
        }


class PerformancePlanner:
    def __init__(self, personality: Optional[DJPersonality] = None):
        self.personality = personality or get_personality("club")

    def set_personality(self, personality: DJPersonality):
        self.personality = personality

    def create_transition_plan(
        self,
        current_track: Track,
        incoming_track: Track,
        preferred_style: Optional[TransitionStyle] = None
    ) -> StructuredTransitionPlan:
        """
        Synthesizes a complete 10-point transition plan between two tracks.
        Automatically selects appropriate transition style, timing, stems, EQ, and effects.
        """
        # 1. Check Technical Audio Data & Tempos
        curr_bpm = current_track.effective_bpm
        inc_bpm = incoming_track.effective_bpm
        bpm_diff = abs(inc_bpm - curr_bpm)

        # Target BPM: default to middle ground or incoming deck target
        target_bpm = round((curr_bpm + inc_bpm) / 2.0, 1)
        curr_pitch_shift = round(((target_bpm - curr_bpm) / (curr_bpm + 1e-6)) * 100.0, 2)
        inc_pitch_shift = round(((target_bpm - inc_bpm) / (inc_bpm + 1e-6)) * 100.0, 2)

        # 2. Select Transition Style based on BPM, genre, and personality
        if preferred_style:
            style = preferred_style
        elif bpm_diff > 6.0:
            # Tempo jump > 6 BPM cannot be smoothly beatmatched without noticeable pitch warping
            style = TransitionStyle.ECHO_OUT
        elif self.personality.id == "melodic":
            style = TransitionStyle.EXTENDED_MIX
        elif self.personality.id == "festival":
            style = TransitionStyle.BUILDUP_DROP
        elif incoming_track.vocal_presence > 0.65 and current_track.vocal_presence < 0.30:
            style = TransitionStyle.VOCAL_OVERLAY
        else:
            style = TransitionStyle.SMOOTH_BLEND

        # For ECHO_OUT cuts across large BPM differences, drop incoming track at native BPM
        if style == TransitionStyle.ECHO_OUT:
            target_bpm = round(inc_bpm, 1) if inc_bpm > 0 else (round(curr_bpm, 1) if curr_bpm > 0 else 124.0)
            curr_pitch_shift = 0.0
            inc_pitch_shift = 0.0

        # Safety floor on target_bpm to prevent division by zero on corrupt/unanalyzed audio
        target_bpm = max(20.0, target_bpm)

        # 3. Phrase Length & Duration
        if style == TransitionStyle.EXTENDED_MIX:
            duration_beats = 64
        elif style in (TransitionStyle.ECHO_OUT, TransitionStyle.LOOP_BASED):
            duration_beats = 16
        else:
            duration_beats = self.personality.preferred_phrase_length or 32

        seconds_per_beat = 60.0 / target_bpm
        duration_seconds = round(duration_beats * seconds_per_beat, 2)

        # 4. Recommended Transition Start Timing
        # Starts on current track's outro cue, or roughly (duration - blend_length - 8s)
        curr_dur = current_track.duration
        if current_track.effective_cue_out > 0:
            start_time = max(10.0, current_track.effective_cue_out - (duration_seconds * 0.5))
        else:
            start_time = max(10.0, curr_dur - duration_seconds - 16.0)
        start_time = round(start_time, 2)

        # 5. Harmonic & Key Compatibility
        curr_key = current_track.effective_key
        inc_key = incoming_track.effective_key
        compatible, harm_points, relation = get_harmonic_compatibility(curr_key, inc_key)

        key_compat = {
            "current_key": curr_key,
            "incoming_key": inc_key,
            "is_compatible": compatible,
            "score": harm_points,
            "relationship": relation,
            "requires_key_lock": True
        }

        # 6. Phrase Alignment
        phrase_length = self.personality.preferred_phrase_length or 32
        phrase_compat = {
            "phrase_length_beats": phrase_length,
            "bars_in_phrase": phrase_length // 4,
            "sync_downbeat": True,
            "downbeat_offset_beats": 0
        }

        # 7. Stem Requirements
        stem_reqs = self._generate_stem_instructions(current_track, incoming_track, style)

        # 8. EQ Instructions
        eq_inst = self._generate_eq_instructions(style, duration_beats)

        # 9. Effects Instructions
        fx_inst = self._generate_effects_instructions(style, duration_beats)

        # 10. Loop Opportunity
        loop_opp = None
        if style == TransitionStyle.LOOP_BASED or bpm_diff > 4.0:
            loop_opp = {
                "deck": "incoming",
                "loop_length_beats": 8,
                "position_seconds": incoming_track.effective_cue_in,
                "release_at_beat": duration_beats // 2
            }

        # Build plan
        plan = StructuredTransitionPlan(
            current_track=current_track.to_dict(),
            incoming_track=incoming_track.to_dict(),
            transition_style=style,
            recommended_transition_start=start_time,
            transition_start_phrase_beat=0,
            duration_beats=duration_beats,
            duration_seconds=duration_seconds,
            target_bpm=target_bpm,
            current_pitch_shift_pct=curr_pitch_shift,
            incoming_pitch_shift_pct=inc_pitch_shift,
            key_compatibility=key_compat,
            phrase_compatibility=phrase_compat,
            stem_requirements=stem_reqs,
            eq_instructions=eq_inst,
            effects_instructions=fx_inst,
            loop_opportunity=loop_opp
        )

        # 11. Strict Validation
        plan.validation = self.validate_transition_plan(plan, current_track, incoming_track)
        return plan

    def _generate_stem_instructions(
        self,
        current: Track,
        incoming: Track,
        style: TransitionStyle
    ) -> StemInstructions:
        if style == TransitionStyle.VOCAL_OVERLAY:
            return StemInstructions(
                outgoing_stems={"vocal": 0.0, "bass": 0.8, "drums": 0.8, "instruments": 0.4},
                incoming_stems={"vocal": 1.0, "bass": 0.0, "drums": 0.5, "instruments": 0.5},
                vocal_overlay_active=True,
                instrumental_overlay_active=False
            )
        elif style == TransitionStyle.BUILDUP_DROP:
            return StemInstructions(
                outgoing_stems={"vocal": 0.1, "bass": 0.0, "drums": 0.6, "instruments": 0.5},
                incoming_stems={"vocal": 1.0, "bass": 1.0, "drums": 1.0, "instruments": 1.0},
                vocal_overlay_active=False,
                instrumental_overlay_active=False
            )
        else:
            return StemInstructions(
                outgoing_stems={"vocal": 1.0, "bass": 0.0, "drums": 0.7, "instruments": 0.7},
                incoming_stems={"vocal": 1.0, "bass": 1.0, "drums": 1.0, "instruments": 1.0},
                vocal_overlay_active=False,
                instrumental_overlay_active=False
            )

    def _generate_eq_instructions(self, style: TransitionStyle, total_beats: int) -> EQInstructions:
        if style == TransitionStyle.EXTENDED_MIX:
            return EQInstructions(
                low_strategy="gradual_crossfade",
                outgoing_low_curve="linear_decay",
                incoming_low_curve="linear_rise",
                mid_crossfade_curve="s_curve",
                high_crossfade_curve="s_curve",
                bass_swap_beat=total_beats // 2
            )
        elif style == TransitionStyle.ECHO_OUT:
            return EQInstructions(
                low_strategy="instant_downbeat",
                outgoing_low_curve="cut_at_beat_16",
                incoming_low_curve="full_on_entry",
                mid_crossfade_curve="linear",
                high_crossfade_curve="linear",
                bass_swap_beat=total_beats
            )
        else:
            return EQInstructions(
                low_strategy="instant_downbeat",
                outgoing_low_curve="cut_at_beat_32",
                incoming_low_curve="muted_until_drop",
                mid_crossfade_curve="linear",
                high_crossfade_curve="linear",
                bass_swap_beat=32
            )

    def _generate_effects_instructions(self, style: TransitionStyle, total_beats: int) -> EffectsInstructions:
        if style == TransitionStyle.ECHO_OUT:
            return EffectsInstructions(
                primary_effect="echo_freeze",
                filter_max=0.5,
                echo_beats=0.75,  # 3/4 dotted delay
                reverb_wet_level=0.30,
                start_beat=total_beats - 4,
                peak_beat=total_beats
            )
        elif style == TransitionStyle.BUILDUP_DROP:
            return EffectsInstructions(
                primary_effect="filter_hpf",
                filter_max=0.95,
                reverb_wet_level=0.20,
                start_beat=total_beats // 2,
                peak_beat=total_beats - 1
            )
        elif style == TransitionStyle.EXTENDED_MIX:
            return EffectsInstructions(
                primary_effect="reverb_wash",
                filter_max=0.70,
                reverb_wet_level=0.15,
                start_beat=total_beats - 16,
                peak_beat=total_beats
            )
        else:
            return EffectsInstructions(
                primary_effect="filter_hpf",
                filter_max=0.75,
                start_beat=total_beats - 15,
                peak_beat=total_beats - 1
            )

    def validate_transition_plan(
        self,
        plan: StructuredTransitionPlan,
        current: Track,
        incoming: Track
    ) -> ValidationResult:
        """
        Validates the transition plan.
        REJECTS transitions that violate physical or musical safety rules.
        """
        errors: List[str] = []
        warnings: List[str] = []
        confidence = 1.0

        # 1. Missing Analysis Data Checks
        if current.duration <= 0.0 or incoming.duration <= 0.0:
            errors.append("Missing analysis data: One or both tracks have non-positive duration.")

        if current.bpm <= 0.0 or incoming.bpm <= 0.0:
            errors.append("Missing analysis data: BPM is zero or unanalyzed.")

        if not os.path.exists(current.filepath):
            errors.append(f"Source audio file missing: {current.filepath}")

        if not os.path.exists(incoming.filepath):
            errors.append(f"Incoming audio file missing: {incoming.filepath}")

        # 2. Timing Bounds Checks
        if plan.recommended_transition_start <= 0.0:
            warnings.append("Transition start time is at beginning of track.")

        if plan.recommended_transition_start + plan.duration_seconds > current.duration:
            errors.append(
                f"Transition timing overflow: Transition ({plan.recommended_transition_start}s + {plan.duration_seconds}s = "
                f"{plan.recommended_transition_start + plan.duration_seconds:.1f}s) exceeds track duration ({current.duration}s)."
            )

        # 3. Extreme Tempo Incompatibility
        bpm_diff = abs(incoming.effective_bpm - current.effective_bpm)
        pitch_shift = max(abs(plan.current_pitch_shift_pct), abs(plan.incoming_pitch_shift_pct))

        if pitch_shift > 8.0 and plan.transition_style not in (TransitionStyle.ECHO_OUT, TransitionStyle.LOOP_BASED):
            errors.append(
                f"Incompatible tempo: Pitch shift of {pitch_shift:.1f}% exceeds ±8.0% limit without an Echo Out or Cut style."
            )
        elif pitch_shift > 4.0:
            warnings.append(f"Moderate pitch shift ({pitch_shift:.1f}%): Keylock / master tempo required.")
            confidence -= 0.15

        # 4. Harmonic Compatibility
        if not plan.key_compatibility["is_compatible"]:
            if self.personality.harmonic_strictness >= 2.0:
                errors.append(
                    f"Strict harmonic rejection: Personality '{self.personality.name}' forbids harmonic clash "
                    f"({current.effective_key} vs {incoming.effective_key})."
                )
            else:
                warnings.append(f"Harmonic clash ({current.effective_key} vs {incoming.effective_key}): Dissonance expected.")
                confidence -= 0.25

        # 5. Missing File Scanned Status
        if current.scan_status == "error" or incoming.scan_status == "error":
            errors.append("Cannot plan transition: Audio file has corrupted scan status.")

        is_valid = len(errors) == 0
        final_confidence = round(max(0.0, min(1.0, confidence if is_valid else 0.0)), 2)

        return ValidationResult(
            is_valid=is_valid,
            confidence_score=final_confidence,
            validation_errors=errors,
            warnings=warnings
        )
