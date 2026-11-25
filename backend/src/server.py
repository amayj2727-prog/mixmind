"""
MIXMIND FastAPI + Librosa Audio Analysis Server
Provides production HTTP endpoints for audio BPM, Camelot key, energy,
and structural cue extraction for the MIXMIND web frontend.
"""

import os
import re
import tempfile
import logging
from typing import List, Optional

import librosa
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .analysis.audio_analyzer import AudioAnalyzer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("MIXMIND-API")

app = FastAPI(
    title="MIXMIND Audio Analysis API",
    version="2.4.0",
    description="Librosa DSP & Camelot harmonic analysis microservice for MIXMIND.",
)

# Parse ALLOWED_ORIGINS env var (comma-separated, supports wildcards like https://*.vercel.app)
raw_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000,https://*.vercel.app")
exact_origins: List[str] = []
regex_parts: List[str] = []

for entry in raw_origins.split(","):
    origin = entry.strip().rstrip("/")
    if not origin:
        continue
    if "*" in origin:
        escaped = re.escape(origin).replace(r"\*", ".*")
        regex_parts.append(f"^{escaped}$")
    else:
        exact_origins.append(origin)

allow_origin_regex: Optional[str] = "|".join(regex_parts) if regex_parts else None

app.add_middleware(
    CORSMiddleware,
    allow_origins=exact_origins,
    allow_origin_regex=allow_origin_regex,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

analyzer = AudioAnalyzer()

SUPPORTED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg", ".aiff"}
ANALYSIS_WINDOW_SECONDS = float(os.environ.get("ANALYSIS_WINDOW_SECONDS", "45.0"))


@app.get("/health")
async def health_check():
    """Lightweight health check for Render, Railway, and Fly.io."""
    return {
        "status": "ok",
        "service": "mixmind-audio-api",
        "librosa": librosa.__version__,
    }


@app.post("/api/analyze")
async def analyze_audio(file: UploadFile = File(...)):
    """
    Analyzes an uploaded audio track using Librosa (22.05kHz mono, 45s window)
    and returns BPM, Camelot key, energy, danceability, and cue points
    matching frontend/src/utils/apiClient.ts BackendAnalysisResponse.
    """
    filename = file.filename or "upload.mp3"
    _, ext = os.path.splitext(filename.lower())
    if ext and ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported audio format: {ext}")

    tmp_path = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=ext or ".mp3", delete=False) as tmp:
            tmp_path = tmp.name
            contents = await file.read()
            if not contents:
                raise HTTPException(status_code=400, detail="Empty audio file uploaded.")
            tmp.write(contents)

        report = analyzer.analyze_file(
            tmp_path,
            force_reanalysis=True,
            max_duration=ANALYSIS_WINDOW_SECONDS,
        )

        raw_intro = getattr(report.intro_cue, "start_time", report.intro_cue)
        intro_sec = round(float(raw_intro), 3) if raw_intro is not None else 0.05
        raw_drop = getattr(report.drops[0], "start_time", report.drops[0]) if report.drops else None
        drop_sec = round(float(raw_drop), 3) if raw_drop is not None else 30.0

        return {
            "bpm": report.estimated.bpm,
            "key": report.estimated.camelot_key,
            "energy": report.estimated.energy_rating,
            "danceability": report.estimated.danceability,
            "vocalPresence": report.estimated.vocal_presence,
            "firstBeatSec": intro_sec,
            "introCueSec": intro_sec,
            "dropTimeSec": drop_sec,
            "processingTimeSec": report.processing_time_seconds,
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("Audio analysis failed for %s", filename)
        raise HTTPException(status_code=500, detail=f"Audio analysis failed: {exc}") from exc
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
