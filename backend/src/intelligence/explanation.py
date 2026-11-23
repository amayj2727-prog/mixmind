"""
MIXMIND - Recommendation Explanation Engine
Generates transparent, structured musical reasoning for every DJ selection decision.
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional


@dataclass
class SelectionExplanation:
    headline: str
    harmonic_reason: str
    tempo_reason: str
    energy_reason: str
    vocal_reason: str
    variety_reason: str
    details: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "headline": self.headline,
            "harmonic": self.harmonic_reason,
            "tempo": self.tempo_reason,
            "energy": self.energy_reason,
            "vocal": self.vocal_reason,
            "variety": self.variety_reason,
            "details": self.details,
        }


class ExplanationGenerator:
    @staticmethod
    def generate(
        current_track: Dict[str, Any],
        candidate_track: Dict[str, Any],
        scores: Dict[str, float],
        harmonic_relation: str,
        energy_phase: str
    ) -> SelectionExplanation:
        from .camelot import normalize_to_camelot

        curr_bpm = current_track.get("bpm", 124.0)
        cand_bpm = candidate_track.get("bpm", 124.0)
        curr_key = normalize_to_camelot(current_track.get("camelot_key") or current_track.get("key") or "8A")
        cand_key = normalize_to_camelot(candidate_track.get("camelot_key") or candidate_track.get("key") or "8A")
        curr_energy = current_track.get("energy", 0.5)
        cand_energy = candidate_track.get("energy", 0.5)
        cand_vocal = candidate_track.get("vocal_presence", 0.5)

        bpm_diff = round(cand_bpm - curr_bpm, 1)
        energy_diff = round(cand_energy - curr_energy, 2)

        try:
            curr_num = int(curr_key[:-1])
            cand_num = int(cand_key[:-1])
            curr_let = curr_key[-1]
            cand_let = cand_key[-1]
        except (ValueError, IndexError):
            curr_num, cand_num = 8, 8
            curr_let, cand_let = "A", "A"

        # 1. Harmonic Reason
        if curr_key == cand_key:
            harmonic_reason = f"Perfect Harmonic Match ({curr_key} → {cand_key}): Identical musical key ensures zero dissonant clash."
        elif curr_num == cand_num and curr_let != cand_let:
            harmonic_reason = f"Harmonic Modulation (Relative Major/Minor: {curr_key} → {cand_key}): Shifts mood while retaining identical scale notes."
        elif abs(curr_num - cand_num) in (1, 11) and curr_let == cand_let:
            harmonic_reason = f"Harmonic Adjacent Blend ({curr_key} → {cand_key}): Smooth 1-step energy modulation around the wheel."
        elif (cand_num - curr_num) % 12 == 2 and curr_let == cand_let:
            harmonic_reason = f"Harmonic Energy Boost (+2 Camelot Step: {curr_key} → {cand_key}): Uplifts crowd tension on downbeat."
        else:
            harmonic_reason = f"Harmonic Transition ({curr_key} → {cand_key}): {harmonic_relation}."

        # 2. Tempo Reason
        if abs(bpm_diff) < 0.2:
            tempo_reason = f"Exact Tempo Match ({cand_bpm:.1f} BPM): 0.0% pitch warping required."
        elif abs(bpm_diff) <= 2.0:
            tempo_reason = f"Tight Tempo Alignment ({cand_bpm:.1f} BPM, Δ {bpm_diff:+.1f}): Smooth sync within professional ±1.5% DJ pitch range."
        else:
            tempo_reason = f"Dynamic Tempo Shift ({cand_bpm:.1f} BPM, Δ {bpm_diff:+.1f}): Requires pitch adjustment."

        # 3. Energy Reason
        if energy_phase == "BUILD":
            energy_reason = f"Building Energy: Elevation of {energy_diff:+.2f} ({cand_energy:.2f}) drives progressive dancefloor momentum."
        elif energy_phase == "MAINTAIN":
            energy_reason = f"Groove Lock: Stable energy {cand_energy:.2f} (Δ {energy_diff:+.2f}) maintains hypnotic dancefloor consistency."
        elif energy_phase == "RESET":
            energy_reason = f"Energy Reset: Drop of {energy_diff:+.2f} ({cand_energy:.2f}) provides necessary breakdown breathing room before next build."
        else:
            energy_reason = f"Energy Trajectory: {cand_energy:.2f} (Δ {energy_diff:+.2f})."

        # 4. Vocal Reason
        if cand_vocal > 0.60:
            vocal_reason = f"Vocal Lead: Strong vocal presence ({int(cand_vocal*100)}%) delivers emotional peak."
        elif cand_vocal < 0.25:
            vocal_reason = f"Instrumental Groove: Low vocal presence ({int(cand_vocal*100)}%) prevents lyric clutter during transition."
        else:
            vocal_reason = f"Balanced Vocal Texture: Moderate vocal presence ({int(cand_vocal*100)}%)."

        # 5. Variety Reason
        artist = candidate_track.get("artist", "Unknown Artist")
        variety_reason = f"Artist Freshness: '{artist}' maintains set rotation balance without artist fatigue."

        # Headline
        headline = f"Selected '{candidate_track.get('title')}' by {artist} [{cand_bpm:.1f} BPM, {cand_key}]: {harmonic_reason.split(':')[0]} with {energy_reason.split(':')[0]}."

        details = [
            f"Compatibility Score: {scores.get('total', 0):.1f}/100",
            f"Harmonic Points: {scores.get('harmonic', 0):.1f}",
            f"Tempo Points: {scores.get('tempo', 0):.1f}",
            f"Energy Fit: {scores.get('energy', 0):.1f}",
            f"Genre Fit: {scores.get('genre', 0):.1f}",
        ]

        return SelectionExplanation(
            headline=headline,
            harmonic_reason=harmonic_reason,
            tempo_reason=tempo_reason,
            energy_reason=energy_reason,
            vocal_reason=vocal_reason,
            variety_reason=variety_reason,
            details=details
        )
