const https = require('node:https');

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

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function fetchYouTubeHtml(url, depth = 0) {
  if (depth > 3) return Promise.resolve('');
  return new Promise((resolve) => {
    https
      .get(
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
            return fetchYouTubeHtml(res.headers.location, depth + 1).then(resolve);
          }
          let html = '';
          res.on('data', (c) => (html += c));
          res.on('end', () => resolve(html));
        }
      )
      .on('error', () => resolve(''));
  });
}

async function scrapeYouTubePlaylist(playlistId) {
  const html = await fetchYouTubeHtml(`https://www.youtube.com/playlist?list=${playlistId}`);
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

  const rawTracks = [];

  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[1]);

      function extractVideos(obj) {
        if (!obj || typeof obj !== 'object') return;

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
      // Fallback
    }
  }

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { list } = req.query || {};
  if (!list) {
    return res.status(400).json({ success: false, error: 'Missing list parameter' });
  }

  try {
    const playlist = await scrapeYouTubePlaylist(list);
    if (playlist && playlist.tracks && playlist.tracks.length > 0) {
      return res.status(200).json({ success: true, playlist });
    }
    return res.status(404).json({ success: false, error: 'Could not extract playlist' });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
};
