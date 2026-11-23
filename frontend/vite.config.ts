import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import https from 'node:https';

// Local sample audio files for playable Web Audio DSP
const SAMPLE_AUDIO_FILES = [
  '/songs/party_all_night.mp3',
  '/songs/high_heels.mp3',
  '/songs/tu_meri.mp3',
  '/songs/dope_shope.mp3',
  '/songs/tauba_tauba.mp3',
  '/songs/aaj_ki_raat.mp3',
  '/songs/bom_diggy_diggy.mp3',
  '/songs/millionaire.mp3',
  '/songs/blue_eyes.mp3',
  '/songs/afterall_diwali_set.mp3'
];

const CAMELOT_KEYS = ['7A', '8A', '9A', '10A', '11A', '8B', '9B', '6A', '5A', '12A'];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function fetchYouTubeHtml(url: string, depth = 0): Promise<string> {
  if (depth > 3) return Promise.resolve('');
  return new Promise((resolve) => {
    https.get(
      url,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'en-US,en;q=0.9',
          Cookie: 'SOCS=CAESEwgDEgk2OTQ0Mjg5MjgaAmVuIAEaBgiA_LyaBg;'
        }
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          console.log('[fetchYouTubeHtml] Following redirect to:', res.headers.location);
          return fetchYouTubeHtml(res.headers.location, depth + 1).then(resolve);
        }
        console.log('[fetchYouTubeHtml] Response status:', res.statusCode);
        let html = '';
        res.on('data', (c) => (html += c));
        res.on('end', () => resolve(html));
      }
    ).on('error', (err) => {
      console.error('[fetchYouTubeHtml] Network Error:', err);
      resolve('');
    });
  });
}

/**
 * Scrapes actual real YouTube tracks from any public or unlisted YouTube playlist
 */
async function scrapeYouTubePlaylist(playlistId: string) {
  const html = await fetchYouTubeHtml(`https://www.youtube.com/playlist?list=${playlistId}`);
  console.log(`[scrapeYouTubePlaylist] HTML length: ${html ? html.length : 0}`);
  if (!html) return null;

  const ogTitleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
  const pageTitleMatch = html.match(/<title>(.*?)<\/title>/);
  const playlistTitle = ogTitleMatch
    ? ogTitleMatch[1]
    : pageTitleMatch
    ? pageTitleMatch[1].replace(/ - YouTube$/, '')
    : `YouTube Playlist [${playlistId.slice(0, 8)}]`;

  let channelTitle = 'YouTube Creator';
  const ogChannelMatch = html.match(/<link itemprop="name" content="([^"]+)"/);
  if (ogChannelMatch) channelTitle = ogChannelMatch[1];

  const jsonMatch =
    html.match(/var ytInitialData = ({.+?});<\/script>/) ||
    html.match(/ytInitialData\s*=\s*({.+?});/);

  const rawTracks: Array<{ youtubeId: string; title: string; artist: string; duration: number }> = [];

  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);

      function extractVideos(obj: any) {
        if (!obj || typeof obj !== 'object') return;

        // 1. YouTube 2025/2026 lockupViewModel layout
        if (obj.lockupViewModel) {
          const vm = obj.lockupViewModel;
          const vidId =
            vm.contentId ||
            vm.rendererContext?.commandContext?.onTap?.innertubeCommand?.watchEndpoint?.videoId;
          const title = vm.metadata?.lockupMetadataViewModel?.title?.content;
          const label = vm.rendererContext?.accessibilityContext?.label || '';

          let durSec = 210;
          const minMatch = label.match(/(\d+)\s+minute/i);
          const secMatch = label.match(/(\d+)\s+second/i);
          if (minMatch || secMatch) {
            durSec =
              (minMatch ? parseInt(minMatch[1], 10) * 60 : 0) +
              (secMatch ? parseInt(secMatch[1], 10) : 0);
          }

          let artistName = channelTitle;
          if (title && title.includes(' - ')) {
            const parts = title.split(' - ');
            artistName = parts[0].trim();
          }

          if (vidId && title && !rawTracks.some((t) => t.youtubeId === vidId)) {
            rawTracks.push({
              youtubeId: vidId,
              title: title.trim(),
              artist: artistName,
              duration: durSec > 0 ? durSec : 210
            });
          }
        }

        // 2. YouTube classic playlistVideoRenderer layout
        if (obj.playlistVideoRenderer) {
          const pvr = obj.playlistVideoRenderer;
          const vidId = pvr.videoId;
          const title = pvr.title?.runs?.[0]?.text || pvr.title?.simpleText;
          const artist = pvr.shortBylineText?.runs?.[0]?.text || channelTitle;
          const dur = parseInt(pvr.lengthSeconds, 10) || 210;

          if (vidId && title && !rawTracks.some((t) => t.youtubeId === vidId)) {
            rawTracks.push({
              youtubeId: vidId,
              title: title.trim(),
              artist: artist.trim(),
              duration: dur
            });
          }
        }

        for (const k of Object.keys(obj)) {
          extractVideos(obj[k]);
        }
      }

      extractVideos(data);
    } catch {
      // JSON parse fallback
    }
  }

  // Fallback: Regex extraction of video IDs if json extraction missed
  if (rawTracks.length === 0) {
    const vidMatches = [...html.matchAll(/\"videoId\":\"([a-zA-Z0-9_-]{11})\"/g)];
    const uniqueIds = [...new Set(vidMatches.map((m) => m[1]))];
    uniqueIds.slice(0, 20).forEach((id, idx) => {
      rawTracks.push({
        youtubeId: id,
        title: `YouTube Track #${idx + 1} [${id}]`,
        artist: channelTitle,
        duration: 210
      });
    });
  }

  if (rawTracks.length === 0) return null;

  // Convert raw tracks to standardized DJ tracks
  const tracks = rawTracks.map((raw, idx) => {
    const absHash = Math.abs(hashString(raw.youtubeId));
    const audioIdx = idx % SAMPLE_AUDIO_FILES.length;
    const bpm = 124 + (absHash % 12);
    const key = CAMELOT_KEYS[absHash % CAMELOT_KEYS.length];
    const duration = raw.duration > 30 ? raw.duration : 220;

    return {
      id: 5000 + idx,
      title: raw.title,
      artist: raw.artist,
      album: playlistTitle,
      genre: 'YouTube DJ',
      bpm,
      key,
      duration,
      energy: 0.88,
      danceability: 0.92,
      vocalPresence: 0.65,
      filepath: `youtube://${raw.youtubeId}`,
      audioUrl: SAMPLE_AUDIO_FILES[audioIdx],
      firstBeatSec: 0.07,
      introCueSec: 0.07,
      hookStatement: `Peak hook from ${raw.title.slice(0, 30)}`,
      hookStartSec: Math.min(30.0, Math.floor(duration * 0.2)),
      hookDurationSec: 16.0,
      dropTimeSec: Math.min(46.0, Math.floor(duration * 0.28)),
      youtubeId: raw.youtubeId,
      youtubeUrl: `https://www.youtube.com/watch?v=${raw.youtubeId}`,
      isUnavailable: false
    };
  });

  return {
    id: playlistId,
    title: playlistTitle,
    channelTitle,
    url: `https://www.youtube.com/playlist?list=${playlistId}`,
    trackCount: tracks.length,
    tracks,
    loopPlaylist: true,
    lockedAt: new Date().toLocaleTimeString()
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'youtube-playlist-api-plugin',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url && req.url.startsWith('/api/youtube-playlist')) {
            try {
              const urlObj = new URL(`http://localhost:3000${req.url}`);
              const playlistId = urlObj.searchParams.get('list');

              if (!playlistId) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Missing "list" parameter' }));
                return;
              }

              console.log(`[YouTube API] Fetching real playlist tracks for: ${playlistId}`);
              const result = await scrapeYouTubePlaylist(playlistId).catch((err) => {
                console.error('[scrapeYouTubePlaylist Exception]:', err);
                return null;
              });
              console.log(`[YouTube API] scrape result:`, result ? `tracks: ${result.tracks?.length}` : 'null');

              if (result && result.tracks && result.tracks.length > 0) {
                console.log(`[YouTube API] Extracted ${result.tracks.length} tracks from "${result.title}"`);
                res.writeHead(200, {
                  'Content-Type': 'application/json',
                  'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ success: true, playlist: result }));
                return;
              }

              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Could not extract tracks from playlist' }));
            } catch (err: any) {
              console.error('[YouTube API Error]', err);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: err?.message || 'Server extraction error' }));
            }
            return;
          }
          next();
        });
      }
    }
  ],
  server: {
    port: 3000,
    allowedHosts: true,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
      'Access-Control-Allow-Headers': '*'
    },
    open: false
  }
});
