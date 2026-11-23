import { Track } from '../types';

/**
 * Parses user-uploaded audio files (.mp3, .wav, .m4a, .aac, .flac)
 * and constructs fully functional Track models with real playable blob URLs.
 */
export const processAudioFile = (file: File): Promise<Track> => {
  return new Promise((resolve) => {
    const blobUrl = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = blobUrl;

    // Clean up filename (remove extension)
    let baseName = file.name.replace(/\.[^/.]+$/, '');
    let bpm = 128;

    // Detect BPM prefix if present (e.g. "130-Song Title" or "126 - Artist - Title")
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

    const onFinish = (dur: number) => {
      resolve({
        id: Date.now() + Math.floor(Math.random() * 100000),
        title: title || file.name,
        artist: artist || 'Local Artist',
        album: 'My Uploads',
        genre: 'Local Music',
        bpm,
        key: '8A', // Camelot harmonic anchor
        duration: Math.round(dur * 10) / 10,
        energy: 0.88,
        danceability: 0.92,
        vocalPresence: 0.65,
        filepath: file.name,
        audioUrl: blobUrl,
        firstBeatSec: 0.05,
        introCueSec: 0.05,
        hookStatement: `Playing ${title}`
      });
    };

    audio.addEventListener('loadedmetadata', () => {
      const duration = audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)
        ? audio.duration
        : 240;
      onFinish(duration);
    }, { once: true });

    audio.addEventListener('error', () => {
      onFinish(240);
    }, { once: true });

    // Fallback timeout in case browser takes too long on metadata
    setTimeout(() => {
      onFinish(240);
    }, 1500);
  });
};
