FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    NUMBA_CACHE_DIR=/tmp/numba_cache \
    MIXMIND_CACHE_DIR=/tmp/mixmind_cache/analysis

WORKDIR /app

# Install libsndfile1 and ffmpeg so librosa decodes .mp3, .wav, and .m4a reliably
RUN apt-get update && \
    apt-get install -y --no-install-recommends libsndfile1 ffmpeg && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY backend/ ./backend/

EXPOSE 8000

CMD ["sh", "-c", "uvicorn backend.src.server:app --host 0.0.0.0 --port ${PORT:-8000}"]
