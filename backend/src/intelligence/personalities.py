"""
MIXMIND - DJ Personality Engine
Original, configurable musical behaviour profiles:
- MELODIC: Emotional EDM, melodic progression, atmospheric transitions, long blends.
- FESTIVAL: High-energy EDM, energetic build-ups, powerful drops, creative punchy transitions.
- CLUB: House and tech-house focus, groove continuity, extended mixes, restrained effects.
Also supports user-defined custom personalities with disk persistence and validation.
"""

import os
import json
import logging
from dataclasses import dataclass, asdict, field
from typing import Dict, Any, List, Optional, Tuple

from .camelot import get_harmonic_compatibility
from .genre_matrix import get_genre_compatibility

logger = logging.getLogger("Personalities")

DEFAULT_CUSTOM_PATH = os.path.expanduser("~/Desktop/MIXMIND/data/library/personalities.json")


@dataclass
class TransitionProfile:
    intro_beats: int = 16
    buildup_beats: int = 16
    outro_beats: int = 16
    total_beats: int = 32
    filter_sweep_intensity: float = 0.25      # 0.0 to 1.0 (High-pass filter rise depth)
    vocal_ducking_depth: float = 0.70         # 0.0 to 1.0 (Ducking outgoing vocals during blend)
    bass_swap_mode: str = "instant_downbeat"   # "instant_downbeat", "gradual_crossfade", "frequency_crossover"
    curve_type: str = "linear"                # "linear", "exponential", "s_curve"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class VocalMixingConfig:
    prefer_vocals: bool = False               # Whether personality actively favors vocal tracks
    vocal_ducking_depth: float = 0.70         # Vocal suppression during transition
    vocal_preservation: float = 0.50          # Preserves vocal hooks during breakdown

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class EffectsProfile:
    filter_sweep_intensity: float = 0.25      # Maximum HPF sweep level
    eq_cut_sharpness: float = 0.70            # Sharpness of EQ frequency cuts
    fx_wet_level: float = 0.15                # Additional space/reverb depth

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class TransitionPlan:
    """Actionable transition blueprint for the transition engine."""
    total_beats: int
    intro_beats: int
    buildup_beats: int
    outro_beats: int
    filter_max: float
    vocal_ducking_depth: float
    bass_swap_mode: str
    curve_type: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DJPersonality:
    id: str
    name: str
    description: str
    preferred_genres: List[str]
    energy_range: Tuple[float, float]
    target_bpm_range: Tuple[float, float]
    max_bpm_jump: float
    harmonic_strictness: float
    energy_target_slope: float
    preferred_phrase_length: int
    progression_strategy: str                # "harmonic_flow", "peak_driver", "groove_lock", "wave_progression"
    transition: TransitionProfile = field(default_factory=TransitionProfile)
    vocal_config: VocalMixingConfig = field(default_factory=VocalMixingConfig)
    effects: EffectsProfile = field(default_factory=EffectsProfile)
    is_custom: bool = False

    def score_track(
        self,
        current_track: Dict[str, Any],
        candidate_track: Dict[str, Any],
        play_history: List[str]
    ) -> float:
        """
        Evaluates candidate track against this personality's distinct aesthetic:
        - Harmonic tolerance & strictness
        - Preferred BPM range and maximum tempo jump
        - Energy trajectory and target energy range
        - Genre affinity
        - Vocal mixing preferences
        """
        score = 100.0

        filepath = candidate_track.get("filepath", "")
        if filepath in play_history:
            return -1000.0

        curr_bpm = float(current_track.get("bpm", 124.0))
        cand_bpm = float(candidate_track.get("bpm", 124.0))
        curr_key = str(current_track.get("camelot_key", "8A"))
        cand_key = str(candidate_track.get("camelot_key", "8A"))
        curr_energy = float(current_track.get("energy", 0.5))
        cand_energy = float(candidate_track.get("energy", 0.5))
        cand_genre = str(candidate_track.get("genre", "house"))
        cand_vocal = float(candidate_track.get("vocal_presence", 0.5))

        # 1. Harmonic Compatibility Score
        compatible, harm_points, relation = get_harmonic_compatibility(curr_key, cand_key)
        if compatible:
            # For festival / peak-driving DJs, an Energy Boost modulation (+2 on wheel) is celebrated
            if self.progression_strategy == "peak_driver" and "Energy Boost" in relation:
                score += (95.0 * self.harmonic_strictness)
            else:
                score += (harm_points * self.harmonic_strictness)
        else:
            # Severe penalty for clashes if personality has high strictness
            score -= (100.0 - harm_points) * self.harmonic_strictness * 1.5

        # 2. BPM Matching & Target Range Fit
        bpm_diff = abs(cand_bpm - curr_bpm)
        min_target_bpm, max_target_bpm = self.target_bpm_range

        # Penalty if outside personality's ideal BPM pocket
        if cand_bpm < min_target_bpm or cand_bpm > max_target_bpm:
            out_of_bounds = min_target_bpm - cand_bpm if cand_bpm < min_target_bpm else cand_bpm - max_target_bpm
            score -= (out_of_bounds * 8.0)

        # Penalty for jump from current track
        if bpm_diff > self.max_bpm_jump:
            score -= (bpm_diff - self.max_bpm_jump) * 25.0
        else:
            # Festival DJ allows faster tempo ramp-ups without harsh penalty
            tempo_decay = 2.0 if self.progression_strategy == "peak_driver" else 4.0
            score -= (bpm_diff * tempo_decay)

        # 3. Energy Trajectory & Energy Range Fit
        min_energy, max_energy = self.energy_range
        if cand_energy < min_energy or cand_energy > max_energy:
            e_dist = min_energy - cand_energy if cand_energy < min_energy else cand_energy - max_energy
            score -= (e_dist * 80.0)

        energy_diff = cand_energy - curr_energy

        if self.progression_strategy == "peak_driver":
            # Festival DJ: Drive towards peak energy (0.80 - 1.0)
            score += (cand_energy * 55.0)
            if cand_energy < 0.75:
                score -= (0.75 - cand_energy) * 100.0  # Heavy penalty for low-energy tracks
            if energy_diff >= 0:
                score += 20.0
            else:
                score -= abs(energy_diff) * 35.0

        elif self.progression_strategy == "harmonic_flow":
            # Melodic DJ: Smooth progressive rise without violent jumps
            if 0.02 <= energy_diff <= 0.15:
                score += 30.0
            elif energy_diff > 0.15:
                score -= (energy_diff - 0.15) * 40.0  # Jarring jump penalty
            else:
                score -= abs(energy_diff) * 20.0

        elif self.progression_strategy == "groove_lock":
            # Club DJ: Maintain hypnotic steady groove (|dE| <= 0.08)
            score -= (abs(energy_diff) * 50.0)

        # 4. Genre Affinity Score
        genre_matches = [get_genre_compatibility(pref, cand_genre) for pref in self.preferred_genres]
        best_genre_match = max(genre_matches) if genre_matches else 0.5
        score += (best_genre_match * 35.0)

        # 5. Vocal Preferences
        if self.vocal_config.prefer_vocals:
            score += (cand_vocal * 20.0)
        else:
            # Club / Festival: prefer driving instrumental or restrained vocals
            if cand_vocal > 0.70:
                score -= 10.0
            elif cand_vocal < 0.35:
                score += 10.0

        return score

    def create_transition_plan(self, current_track: Dict[str, Any], next_track: Dict[str, Any]) -> TransitionPlan:
        """Generates a concrete execution plan for mixing from current to next track."""
        p = self.transition
        return TransitionPlan(
            total_beats=p.total_beats,
            intro_beats=p.intro_beats,
            buildup_beats=p.buildup_beats,
            outro_beats=p.outro_beats,
            filter_max=0.5 + p.filter_sweep_intensity,
            vocal_ducking_depth=p.vocal_ducking_depth,
            bass_swap_mode=p.bass_swap_mode,
            curve_type=p.curve_type
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "preferred_genres": self.preferred_genres,
            "energy_range": list(self.energy_range),
            "target_bpm_range": list(self.target_bpm_range),
            "max_bpm_jump": self.max_bpm_jump,
            "harmonic_strictness": self.harmonic_strictness,
            "energy_target_slope": self.energy_target_slope,
            "preferred_phrase_length": self.preferred_phrase_length,
            "progression_strategy": self.progression_strategy,
            "transition": self.transition.to_dict(),
            "vocal_config": self.vocal_config.to_dict(),
            "effects": self.effects.to_dict(),
            "is_custom": self.is_custom,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "DJPersonality":
        trans_dict = d.get("transition", {})
        vocal_dict = d.get("vocal_config", {})
        fx_dict = d.get("effects", {})

        return cls(
            id=d["id"],
            name=d["name"],
            description=d.get("description", ""),
            preferred_genres=d.get("preferred_genres", ["house"]),
            energy_range=tuple(d.get("energy_range", (0.5, 0.8))),
            target_bpm_range=tuple(d.get("target_bpm_range", (120.0, 128.0))),
            max_bpm_jump=float(d.get("max_bpm_jump", 4.0)),
            harmonic_strictness=float(d.get("harmonic_strictness", 1.5)),
            energy_target_slope=float(d.get("energy_target_slope", 0.0)),
            preferred_phrase_length=int(d.get("preferred_phrase_length", 32)),
            progression_strategy=d.get("progression_strategy", "groove_lock"),
            transition=TransitionProfile(**trans_dict) if trans_dict else TransitionProfile(),
            vocal_config=VocalMixingConfig(**vocal_dict) if vocal_dict else VocalMixingConfig(),
            effects=EffectsProfile(**fx_dict) if fx_dict else EffectsProfile(),
            is_custom=bool(d.get("is_custom", False))
        )


# =====================================================================
# 1. MELODIC DJ: Emotional EDM, progressive flow, 64-beat blends
# =====================================================================
MELODIC_DJ = DJPersonality(
    id="melodic",
    name="Melodic DJ",
    description="Refined harmonic journeys with long 64-beat blends, preserved vocal melodies, and smooth emotional flow.",
    preferred_genres=["melodic house", "progressive house", "melodic techno", "trance", "deep house"],
    energy_range=(0.40, 0.78),
    target_bpm_range=(120.0, 126.0),
    max_bpm_jump=3.0,
    harmonic_strictness=2.5,  # Highest Camelot adherence
    energy_target_slope=0.10,
    preferred_phrase_length=64,
    progression_strategy="harmonic_flow",
    transition=TransitionProfile(
        intro_beats=32,
        buildup_beats=16,
        outro_beats=16,
        total_beats=64,
        filter_sweep_intensity=0.20,
        vocal_ducking_depth=0.35,  # Preserves vocal warmth
        bass_swap_mode="gradual_crossfade",
        curve_type="s_curve"
    ),
    vocal_config=VocalMixingConfig(
        prefer_vocals=True,
        vocal_ducking_depth=0.35,
        vocal_preservation=0.85
    ),
    effects=EffectsProfile(
        filter_sweep_intensity=0.20,
        eq_cut_sharpness=0.40,
        fx_wet_level=0.25
    )
)

# =====================================================================
# 2. FESTIVAL DJ: High-octane peak energy, punchy 16/32-beat drops
# =====================================================================
FESTIVAL_DJ = DJPersonality(
    id="festival",
    name="Festival DJ",
    description="High-octane peak energy, punchy 16/32-beat transitions, dramatic filter rises, and massive downbeat drops.",
    preferred_genres=["edm", "electro house", "bass house", "festival house", "dance", "tech house"],
    energy_range=(0.75, 1.00),
    target_bpm_range=(125.0, 132.0),
    max_bpm_jump=5.5,
    harmonic_strictness=1.0,  # Allows bold energy boost modulation
    energy_target_slope=0.40,
    preferred_phrase_length=32,
    progression_strategy="peak_driver",
    transition=TransitionProfile(
        intro_beats=8,
        buildup_beats=16,
        outro_beats=8,
        total_beats=32,
        filter_sweep_intensity=0.50,  # Heavy dramatic high-pass
        vocal_ducking_depth=0.90,     # Mutes vocal hard for drop
        bass_swap_mode="instant_downbeat",
        curve_type="exponential"
    ),
    vocal_config=VocalMixingConfig(
        prefer_vocals=False,
        vocal_ducking_depth=0.90,
        vocal_preservation=0.20
    ),
    effects=EffectsProfile(
        filter_sweep_intensity=0.50,
        eq_cut_sharpness=0.95,
        fx_wet_level=0.35
    )
)

# =====================================================================
# 3. CLUB DJ: Disciplined 32-beat groove lock, classic bass swaps
# =====================================================================
CLUB_DJ = DJPersonality(
    id="club",
    name="Club DJ",
    description="Disciplined 32-beat house groove, classic downbeat bass swapping, and rock-solid dancefloor hypnosis.",
    preferred_genres=["tech house", "house", "deep house", "techno", "minimal techno"],
    energy_range=(0.60, 0.85),
    target_bpm_range=(122.0, 127.0),
    max_bpm_jump=3.5,
    harmonic_strictness=1.6,
    energy_target_slope=0.0,
    preferred_phrase_length=32,
    progression_strategy="groove_lock",
    transition=TransitionProfile(
        intro_beats=16,
        buildup_beats=15,
        outro_beats=16,
        total_beats=32,
        filter_sweep_intensity=0.25,
        vocal_ducking_depth=0.70,
        bass_swap_mode="instant_downbeat",
        curve_type="linear"
    ),
    vocal_config=VocalMixingConfig(
        prefer_vocals=False,
        vocal_ducking_depth=0.70,
        vocal_preservation=0.50
    ),
    effects=EffectsProfile(
        filter_sweep_intensity=0.25,
        eq_cut_sharpness=0.70,
        fx_wet_level=0.15
    )
)

# =====================================================================
# 4. LEARNED: BOLLYTECH MIRAGE LIVE (Extracted from 52-min Live DJ Set)
# =====================================================================
BOLLYTECH_MIRAGE_DJ = DJPersonality(
    id="bollytech_mirage",
    name="Bollytech Resident (Mirage Live)",
    description="Reverse-engineered from 52m Mirage live set: 134 BPM, 97% pre-drop highpass filter sweeps, and instant 1-bar bass swaps.",
    preferred_genres=["tech house", "bollytech", "bollyafro", "bass house", "dance", "afro house"],
    energy_range=(0.78, 1.00),
    target_bpm_range=(130.0, 137.0),
    max_bpm_jump=5.0,
    harmonic_strictness=1.1,
    energy_target_slope=0.35,
    preferred_phrase_length=64,
    progression_strategy="peak_driver",
    transition=TransitionProfile(
        intro_beats=16,
        buildup_beats=32,
        outro_beats=16,
        total_beats=64,
        filter_sweep_intensity=0.85,
        vocal_ducking_depth=0.85,
        bass_swap_mode="instant_downbeat",
        curve_type="exponential"
    ),
    vocal_config=VocalMixingConfig(
        prefer_vocals=False,
        vocal_ducking_depth=0.85,
        vocal_preservation=0.30
    ),
    effects=EffectsProfile(
        filter_sweep_intensity=0.85,
        eq_cut_sharpness=0.95,
        fx_wet_level=0.25
    )
)


class PersonalityRegistry:
    """Manages built-in and user-defined custom DJ personalities with persistence."""
    def __init__(self, storage_path: str = DEFAULT_CUSTOM_PATH):
        self.storage_path = storage_path
        self._personalities: Dict[str, DJPersonality] = {
            "melodic": MELODIC_DJ,
            "festival": FESTIVAL_DJ,
            "club": CLUB_DJ,
            "bollytech_mirage": BOLLYTECH_MIRAGE_DJ,
        }
        self._load_custom_personalities()

    def get(self, personality_id: str) -> DJPersonality:
        """Returns the requested personality or defaults to Club DJ."""
        pid = personality_id.lower().strip()
        return self._personalities.get(pid, CLUB_DJ)

    def list_all(self) -> List[DJPersonality]:
        return list(self._personalities.values())

    def register_custom(self, config_dict: Dict[str, Any]) -> DJPersonality:
        """Validates and registers a new user-defined DJ personality."""
        valid, err = self.validate_config(config_dict)
        if not valid:
            raise ValueError(f"Invalid personality configuration: {err}")

        config_dict["is_custom"] = True
        pers = DJPersonality.from_dict(config_dict)
        self._personalities[pers.id.lower()] = pers
        self._save_custom_personalities()
        logger.info(f"Registered custom DJ personality: '{pers.name}' [{pers.id}]")
        return pers

    def delete_custom(self, personality_id: str) -> bool:
        pid = personality_id.lower().strip()
        if pid in self._personalities and self._personalities[pid].is_custom:
            del self._personalities[pid]
            self._save_custom_personalities()
            return True
        return False

    def validate_config(self, d: Dict[str, Any]) -> Tuple[bool, str]:
        if not d.get("id"):
            return False, "Missing required field: 'id'"
        if not d.get("name"):
            return False, "Missing required field: 'name'"
        if d["id"].lower() in ("melodic", "festival", "club"):
            return False, f"Cannot overwrite built-in personality '{d['id']}'"

        # BPM Range validation
        bpm_range = d.get("target_bpm_range")
        if bpm_range:
            if len(bpm_range) != 2 or bpm_range[0] >= bpm_range[1]:
                return False, "target_bpm_range must be a tuple (min_bpm, max_bpm) with min < max"

        # Energy Range validation
        energy_range = d.get("energy_range")
        if energy_range:
            if len(energy_range) != 2 or not (0.0 <= energy_range[0] <= energy_range[1] <= 1.0):
                return False, "energy_range must be (min_energy, max_energy) between 0.0 and 1.0"

        return True, ""

    def _load_custom_personalities(self):
        if not os.path.exists(self.storage_path):
            return
        try:
            with open(self.storage_path, "r") as f:
                data = json.load(f)
            for item in data:
                pers = DJPersonality.from_dict(item)
                self._personalities[pers.id.lower()] = pers
            logger.info(f"Loaded {len(data)} custom personalities from {self.storage_path}")
        except Exception as e:
            logger.warning(f"Failed to load custom personalities from {self.storage_path}: {e}")

    def _save_custom_personalities(self):
        custom_items = [p.to_dict() for p in self._personalities.values() if p.is_custom]
        os.makedirs(os.path.dirname(os.path.abspath(self.storage_path)), exist_ok=True)
        try:
            with open(self.storage_path, "w") as f:
                json.dump(custom_items, f, indent=2)
        except Exception as e:
            logger.error(f"Failed to save custom personalities: {e}")


# Global Registry Instance
REGISTRY = PersonalityRegistry()


def get_personality(personality_id: str) -> DJPersonality:
    return REGISTRY.get(personality_id)
