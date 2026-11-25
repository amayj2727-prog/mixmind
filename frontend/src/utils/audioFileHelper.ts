import { Track } from '../types';
import { analyzeTrackWithFallback } from './apiClient';

/**
 * Parses user-uploaded audio files (.mp3, .wav, .m4a, .aac, .flac)
 * and constructs fully functional Track models with real playable blob URLs.
 * If VITE_API_URL is configured and online, enriches BPM/Camelot key via FastAPI + Librosa.
 */
export const processAudioFile = (file: File): Promise<Track> => {
  return new Promise((resolve) => {
    const blobUrl = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = blobUrl;

    let baseName = file.name.replace(/\.[^/.]+$/, '');
    let bpm = 128;

    const bpmMatch = baseName.match(/^(\d{2,3})[\s\-_]+(.*)$/);
    if (bpmMatch) {
      const parsedBpm = parseInt(bpmMatch[1], 10);
      if (parsedBpm >= 65 && parsedBpm <= 180) {
        bpm = parsedBpm;
        baseName = bpmMatch[2];
      }
    }

    let artist = 'Local Artist';
    let title = baseName;

    if (baseName.includes(' - ')) {
      const parts = baseName.split(' - ');
      artist = parts[0].trim();
      title = parts.slice(1).join(' - ').trim();
    } else if (baseName.includes('-')) {
      const parts = baseName.split('-');
      artist = parts[0].trim();
      title = parts.slice(1).join('-').trim();
    }

    let settled = false;
    const onFinish = async (dur: number) => {
      if (settled) return;
      settled = true;

      const fallbackTrack: Track = {
        id: Date.now() + Math.floor(Math.random() * 100000),
        title: title || file.name,
        artist: artist || 'Local Artist',
        album: 'My Uploads',
        genre: 'Local Music',
        bpm,
        key: '8A',
        duration: Math.round(dur * 10) / 10,
        energy: 0.88,
        danceability: 0.92,
        vocalPresence: 0.65,
        filepath: file.name,
        audioUrl: blobUrl,
        firstBeatSec: 0.05,
        introCueSec: 0.05,
        hookStatement: `Playing ${title}`
      };

      const enriched = await analyzeTrackWithFallback(file, fallbackTrack);
      resolve(enriched);
    };

    audio.addEventListener(
      'loadedmetadata',
      () => {
        const duration =
          audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)
            ? audio.duration
            : 240;
        onFinish(duration);
      },
      { once: true }
    );

    audio.addEventListener(
      'error',
      () => {
        onFinish(240);
      },
      { once: true }
    );

    setTimeout(() => {
      onFinish(240);
    }, 1500);
  });
};
