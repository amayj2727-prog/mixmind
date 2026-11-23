# VirtualDJ Stem Capabilities & Technical Integration Report

## 1. Executive Summary & Capabilities Inspection

VirtualDJ incorporates an internal proprietary real-time neural network for 4-stem and 5-stem audio separation (`vocal`, `instruments`, `bass`, `drums`, and optionally `hihat`/`kick`).

MIXMIND interfaces with VirtualDJ through documented, permitted remote control protocols:
- **OSC Protocol (Open Sound Control)** over UDP (`/vdj/deck/{deck}/stem_{stem}`)
- **VDJScript Command Protocol** (`deck {deck} stem '{stem}' {percent}%`, `deck {deck} stem_mute '{stem}'`)

---

## 2. Documented Integration Interfaces

### Permitted VDJScript Commands
| Command | Action | Supported in MIXMIND |
| :--- | :--- | :---: |
| `deck <d> stem 'vocal' <val>%` | Adjusts vocal isolation volume (0-100%) | Yes |
| `deck <d> stem 'instruments' <val>%` | Adjusts synth/instrumental volume (0-100%) | Yes |
| `deck <d> stem 'bass' <val>%` | Adjusts bassline/sub volume (0-100%) | Yes |
| `deck <d> stem 'drums' <val>%` | Adjusts drum/percussion volume (0-100%) | Yes |
| `deck <d> stem_mute '<stem>'` | Instantly mutes specific stem channel | Yes |
| `deck <d> stem_solo '<stem>'` | Solos specified stem, muting other three | Yes |
| `deck <d> loop <beats>` | Activates seamless phrase loop (4/8/16/32 beats) | Yes |
| `deck <d> sync` | Synchronizes beat grid and tempo to master deck | Yes |

---

## 3. Technical Limitations & Non-Existent Interfaces

1. **No External Offline Separation API**:
   - VirtualDJ does **not** expose a C/C++, CLI, or REST API allowing a third-party Python application to extract raw stem audio files (`.wav` or `.mp3`) directly to disk in background or offline mode.
   - Stems are separated strictly in real time inside VirtualDJ's audio DSP pipeline during playback.
2. **Host Dependency**:
   - When VirtualDJ is closed or the OSC network listener is offline, stem manipulation inside VirtualDJ cannot occur.
3. **No Direct Audio Interception**:
   - VirtualDJ does not route separated stem audio streams back to external applications over OSC (only telemetry like BPM, key, and playhead position are transmitted).

---

## 4. MIXMIND Architecture Solution

To ensure production viability, testing reliability, and compliance with the development principles:

1. **Live Performance Execution**:
   - When connected to VirtualDJ via OSC, MIXMIND's `StemController` transmits real-time stem commands directly to VirtualDJ's active decks.
2. **Mock Stem Engine (`[SIMULATION]`)**:
   - When VirtualDJ is disconnected or during automated testing, MIXMIND switches automatically to `MockStemEngine`.
   - Every proposal and log message explicitly flags `is_simulation = True` so users and systems know stem control is currently simulated.
3. **Local Track Role Identification**:
   - MIXMIND uses its local audio DSP analyzer (`vocal_detector.py` and `structure_detector.py`) to discover vocal leads, instrumental beds, breakdown sections, and drop grooves without requiring VirtualDJ.
4. **Legal & Audio Preservation Invariant**:
   - Original audio files on local disk are strictly read-only and never modified or overwritten.
   - MIXMIND does **not** record, export, or redistribute copyright-protected remixes or bootlegs.
