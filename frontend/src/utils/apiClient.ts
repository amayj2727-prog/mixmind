import { Track } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

export interface BackendAnalysisResponse {
  bpm?: number;
  key?: string;
  energy?: number;
  danceability?: number;
  vocalPresence?: number;
  firstBeatSec?: number;
  introCueSec?: number;
  dropTimeSec?: number;
}

/**
 * Checks whether an external FastAPI + Librosa backend URL is configured.
 */
export function isBackendConfigured(): boolean {
  return API_BASE_URL.length > 0;
}

/**
 * Sends an uploaded audio file to the optional FastAPI + Librosa backend
 * for deep BPM, Camelot key, and phrase cue extraction.
 * Gracefully falls back to client-side metadata if VITE_API_URL is unset or offline.
 */
export async function analyzeTrackWithFallback(
  file: File,
  fallbackTrack: Track
): Promise<Track> {
  if (!API_BASE_URL) {
    return fallbackTrack;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return fallbackTrack;
    }

    const data: BackendAnalysisResponse = await res.json();
    return {
      ...fallbackTrack,
      bpm: typeof data.bpm === 'number' && data.bpm > 40 ? Math.round(data.bpm * 10) / 10 : fallbackTrack.bpm,
      key: typeof data.key === 'string' && data.key.length >= 2 ? data.key : fallbackTrack.key,
      energy: typeof data.energy === 'number' ? data.energy : fallbackTrack.energy,
      danceability: typeof data.danceability === 'number' ? data.danceability : fallbackTrack.danceability,
      vocalPresence: typeof data.vocalPresence === 'number' ? data.vocalPresence : fallbackTrack.vocalPresence,
      firstBeatSec: typeof data.firstBeatSec === 'number' ? data.firstBeatSec : fallbackTrack.firstBeatSec,
      introCueSec: typeof data.introCueSec === 'number' ? data.introCueSec : fallbackTrack.introCueSec,
      dropTimeSec: typeof data.dropTimeSec === 'number' ? data.dropTimeSec : fallbackTrack.dropTimeSec
    };
  } catch {
    // Backend offline or unreachable: return client-side fallback cleanly
    return fallbackTrack;
  }
}
