import React, { useEffect, useRef, useState } from 'react';
import { Info, Volume2 } from 'lucide-react';

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          height?: string | number;
          width?: string | number;
          videoId?: string;
          playerVars?: Record<string, number | string>;
          events?: {
            onReady?: (event: { target: YTPlayerInstance }) => void;
            onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
          };
        }
      ) => YTPlayerInstance;
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

interface YTPlayerInstance {
  loadVideoById: (videoId: string) => void;
  cueVideoById: (videoId: string) => void;
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  setVolume: (vol: number) => void;
  mute: () => void;
  unMute: () => void;
  destroy: () => void;
}

interface YouTubeDualDeckProps {
  deck1VideoId?: string;
  deck2VideoId?: string;
  deck1Playing: boolean;
  deck2Playing: boolean;
  crossfader: number; // 0.0 = Deck 1, 1.0 = Deck 2
  isMuted: boolean;
  enabled: boolean;
}

let ytApiPromise: Promise<void> | null = null;
function loadYouTubeIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise((resolve) => {
    const prevCallback = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevCallback?.();
      resolve();
    };
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    document.head.appendChild(tag);
  });
  return ytApiPromise;
}

/**
 * Dual YouTube IFrame Deck Controller.
 * Uses official YouTube IFrame Player API for volume crossfading & playback
 * when streaming live YouTube video IDs (where browser CORS restricts Web Audio capture).
 */
export const YouTubeDualDeck: React.FC<YouTubeDualDeckProps> = ({
  deck1VideoId,
  deck2VideoId,
  deck1Playing,
  deck2Playing,
  crossfader,
  isMuted,
  enabled
}) => {
  const deck1ContainerRef = useRef<HTMLDivElement>(null);
  const deck2ContainerRef = useRef<HTMLDivElement>(null);
  const player1Ref = useRef<YTPlayerInstance | null>(null);
  const player2Ref = useRef<YTPlayerInstance | null>(null);
  const deck2PrimedRef = useRef<boolean>(false);
  const [apiReady, setApiReady] = useState(false);

  const isRealYtId = (id?: string) => !!id && /^[a-zA-Z0-9_-]{11}$/.test(id);

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    loadYouTubeIframeApi().then(() => {
      if (mounted) setApiReady(true);
    });
    return () => {
      mounted = false;
    };
  }, [enabled]);

  // Initialize / update Deck 1 player
  useEffect(() => {
    if (!enabled || !apiReady || !window.YT || !deck1ContainerRef.current) return;
    if (!isRealYtId(deck1VideoId)) return;

    if (!player1Ref.current) {
      player1Ref.current = new window.YT.Player(deck1ContainerRef.current, {
        height: '120',
        width: '100%',
        videoId: deck1VideoId,
        playerVars: { playsinline: 1, controls: 0, modestbranding: 1, rel: 0, cc_load_policy: 0 },
        events: {
          onReady: (e) => {
            if (isMuted) e.target.mute();
            else e.target.unMute();
            if (deck1Playing) e.target.playVideo();
          }
        }
      });
    } else {
      if (deck1Playing) player1Ref.current.loadVideoById(deck1VideoId!);
      else player1Ref.current.cueVideoById(deck1VideoId!);
    }
  }, [enabled, apiReady, deck1VideoId]);

  // Initialize / update Deck 2 player
  useEffect(() => {
    if (!enabled || !apiReady || !window.YT || !deck2ContainerRef.current) return;
    if (!isRealYtId(deck2VideoId)) return;

    if (!player2Ref.current) {
      player2Ref.current = new window.YT.Player(deck2ContainerRef.current, {
        height: '120',
        width: '100%',
        videoId: deck2VideoId,
        playerVars: { playsinline: 1, controls: 0, modestbranding: 1, rel: 0, cc_load_policy: 0 },
        events: {
          onReady: (e) => {
            if (isMuted) e.target.mute();
            else e.target.unMute();
            if (deck2Playing) {
              e.target.playVideo();
            } else if (deck1Playing && !deck2PrimedRef.current) {
              deck2PrimedRef.current = true;
              e.target.setVolume(0);
              e.target.playVideo();
              setTimeout(() => {
                try {
                  e.target.pauseVideo();
                  e.target.seekTo(0, true);
                } catch {
                  // ignore
                }
              }, 180);
            }
          }
        }
      });
    } else {
      if (deck2Playing) player2Ref.current.loadVideoById(deck2VideoId!);
      else player2Ref.current.cueVideoById(deck2VideoId!);
    }
  }, [enabled, apiReady, deck2VideoId]);

  // Sync Play/Pause & silently prime Deck B on initial user Play click
  useEffect(() => {
    if (!enabled) return;
    try {
      if (deck1Playing) {
        player1Ref.current?.playVideo();
        if (!deck2Playing && !deck2PrimedRef.current && player2Ref.current) {
          deck2PrimedRef.current = true;
          const p2 = player2Ref.current;
          p2.setVolume(0);
          p2.playVideo();
          setTimeout(() => {
            try {
              p2.pauseVideo();
              p2.seekTo(0, true);
            } catch {
              // ignore
            }
          }, 180);
        }
      } else {
        player1Ref.current?.pauseVideo();
      }
    } catch {
      // Player not ready yet
    }
  }, [enabled, deck1Playing, deck2Playing]);

  useEffect(() => {
    if (!enabled) return;
    try {
      if (deck2Playing) player2Ref.current?.playVideo();
      else player2Ref.current?.pauseVideo();
    } catch {
      // Player not ready yet
    }
  }, [enabled, deck2Playing]);

  // Sync Constant-Power Volume Crossfade & Mute
  useEffect(() => {
    if (!enabled) return;
    const clamped = Math.max(0, Math.min(1, crossfader));
    const angle = clamped * 0.5 * Math.PI;
    const vol1 = isMuted ? 0 : Math.round(Math.cos(angle) * 100);
    const vol2 = isMuted ? 0 : Math.round(Math.sin(angle) * 100);

    try {
      player1Ref.current?.setVolume(vol1);
      player2Ref.current?.setVolume(vol2);
    } catch {
      // Player not ready yet
    }
  }, [enabled, crossfader, isMuted]);

  // Cleanup on unmount or disable
  useEffect(() => {
    return () => {
      try {
        player1Ref.current?.destroy();
        player2Ref.current?.destroy();
      } catch {
        // ignore
      }
      player1Ref.current = null;
      player2Ref.current = null;
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="bg-black/60 border border-red-500/30 rounded-2xl p-3 space-y-2.5 text-left">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
        <div className="flex items-center gap-1.5 text-red-400 font-bold">
          <Volume2 className="w-3.5 h-3.5" />
          <span>YOUTUBE DUAL-DECK IFRAME CONTROLLER</span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-400 text-[10px]">
          <Info className="w-3 h-3 text-amber-400 shrink-0" />
          <span>Crossfader & Play/Pause active • 3-Band EQ & Echo Freeze require Local Crate audio</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="rounded-xl overflow-hidden bg-black border border-white/10">
          <div className="px-2.5 py-1 bg-white/[0.04] text-[10px] font-mono text-zinc-400 flex justify-between">
            <span>DECK A STREAM</span>
            <span className="text-[#FF4D00]">{Math.round(Math.cos(crossfader * 0.5 * Math.PI) * 100)}% VOL</span>
          </div>
          <div ref={deck1ContainerRef} className="w-full h-[110px] flex items-center justify-center text-[11px] font-mono text-zinc-600">
            {isRealYtId(deck1VideoId) ? 'Loading YouTube Deck A...' : 'Curated Audio Fallback Active'}
          </div>
        </div>

        <div className="rounded-xl overflow-hidden bg-black border border-white/10">
          <div className="px-2.5 py-1 bg-white/[0.04] text-[10px] font-mono text-zinc-400 flex justify-between">
            <span>DECK B STREAM</span>
            <span className="text-[#FF4D00]">{Math.round(Math.sin(crossfader * 0.5 * Math.PI) * 100)}% VOL</span>
          </div>
          <div ref={deck2ContainerRef} className="w-full h-[110px] flex items-center justify-center text-[11px] font-mono text-zinc-600">
            {isRealYtId(deck2VideoId) ? 'Loading YouTube Deck B...' : 'Curated Audio Fallback Active'}
          </div>
        </div>
      </div>
    </div>
  );
};
