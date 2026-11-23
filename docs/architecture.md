# MIXMIND System Architecture & Technical Specifications

## 1. Overview
MIXMIND runs a modular local Python backend communicating with:
1. **VirtualDJ** via standard OSC 1.0 over UDP (port `8000`).
2. **Local Audio Library** via SQLite and `mutagen` + `librosa` / `numpy` / `soundfile`.
3. **Frontend Shell** via planned Tauri (Rust) IPC or local REST/WebSocket APIs.

---

## 2. Core Modules

### `scanner`
- Crawls local music directories recursively.
- Generates 64KB block SHA-256 hashes combined with file sizes to detect file changes and avoid redundant DSP reprocessing.

### `analysis`
- **Metadata**: Parses standard ID3, Vorbis, and MP4 tags (Title, Artist, Album, BPM, Key, Year).
- **Signal Analysis**: Fast 22.05 kHz audio loading, RMS energy windowing (500ms hops), and Krumhansl-Schmuckler chroma correlation against major and minor pitch class templates.

### `intelligence`
- **Camelot Wheel**: Normalizes musical keys (`Am` -> `8A`, `C` -> `8B`) and calculates harmonic distance:
  - Exact match: 100 pts.
  - Relative major/minor: 95 pts.
  - Adjacent wheel step ($\pm 1$): 90 pts.
  - Diagonal step: 75 pts.
  - Energy boost (+2): 70 pts.
  - Clash: Penalized proportionally to personality strictness.
- **Personalities**: Configuration profiles (`Melodic`, `Festival`, `Club`) setting BPM tolerance, phrase lengths, and transition profiles.

### `transitions`
- State machine executing phrase-aligned transitions:
  - `MONITORING` -> `PREPARING` -> `INTRO_BLEND` -> `BUILDUP` -> `THE_DROP` (Instant Bass Swap) -> `OUTRO_FADE` -> `HANDOFF`.

### `virtualdj`
- Low-level binary OSC encoder and decoder supporting float (`f`), integer (`i`), and string (`s`) arguments.
- High-level client manipulating volume, 3-band EQs, bi-directional filter, and real-time stem levels (vocal and bass).
