"""
MIXMIND - DJ Operational Modes
- AUTOPILOT: AI autonomously selects, queues, and mixes tracks.
- COPILOT: AI generates recommendations and queues transitions pending user approval.
- MANUAL: User manually controls decks; AI monitors and provides visual telemetry.
"""

from enum import Enum


class DJMode(str, Enum):
    AUTOPILOT = "autopilot"
    COPILOT = "copilot"
    MANUAL = "manual"
