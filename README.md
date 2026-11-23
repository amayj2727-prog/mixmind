# 🎧 MIXMIND

**MIXMIND** is an autonomous and copilot AI DJ desktop application designed for live music mixing with VirtualDJ.

Unlike standard crossfaders or playlist generators, MIXMIND understands song structure, tracks harmonic compatibility via the Camelot Wheel, manages frequency and stem separation (preventing vocal and low-end kick clashes), and embodies distinct DJ personalities.

---

## 📁 Project Architecture

```
MIXMIND/
├── backend/
│   ├── src/
│   │   ├── scanner/        # Audio file discovery & hash-based indexing
│   │   ├── analysis/       # Mutagen tag extraction & Librosa/NumPy DSP
│   │   ├── intelligence/   # Camelot wheel harmonic rules & DJ personalities
│   │   ├── dj_engine/      # Autopilot, Copilot, and Manual state controllers
│   │   ├── transitions/    # 16/32/64-beat state machine & mathematical curves
│   │   ├── remix/          # Real-time stem isolation & mashup viability
│   │   ├── virtualdj/      # Bidirectional OSC 1.0 client & packet codecs
│   │   ├── database/       # SQLite schema & ACID transaction layer
│   │   └── main.py         # Primary CLI orchestrator
│   └── tests/              # Comprehensive unit & integration tests
├── frontend/               # Planned React + TypeScript desktop UI (Tauri)
├── data/
│   ├── cache/              # Audio waveforms and temporary feature caches
│   └── library/            # Persistent SQLite database (mixmind.db)
├── docs/                   # Architectural guides & protocol specs
├── scripts/                # Launchers & diagnostic utilities
├── requirements.txt        # Pinned Python audio DSP dependencies
├── .gitignore              # Strict exclusion for user audio and caches
└── README.md
```

---

## 🎛️ DJ Personalities

- **Club DJ**: Rock-solid 32-beat phrase sync (8-bar cycles), classic downbeat bass swapping, and tight vocal clash management.
- **Melodic DJ**: Deep harmonic journeys, extended 64-beat blends, musical filter sweeps, and vocal melody preservation.
- **Festival DJ**: High-octane peak-time transitions (16–32 beats), dramatic high-pass filter rises, and massive downbeat drops.

---

## 🚀 Quick Start

### 1. Configure VirtualDJ (One-Time)
1. Open **VirtualDJ**.
2. Click **Settings (Gear Icon) -> Options**.
3. Set **`oscPort`** to **`8000`**.

### 2. Run MIXMIND
From the `MIXMIND/` directory:

```bash
# Run with default Club DJ profile on local SONGS
./scripts/run_mixmind.sh

# Run with Melodic DJ personality
./scripts/run_mixmind.sh --personality melodic

# Run in Copilot mode
./scripts/run_mixmind.sh --mode copilot
```

---

## 🧪 Testing

Run all unit tests:

```bash
cd MIXMIND
.venv/bin/python3 -m unittest discover -s backend/tests -v
```
