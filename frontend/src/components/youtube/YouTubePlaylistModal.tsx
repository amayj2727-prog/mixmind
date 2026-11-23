import React, { useState } from 'react';
import {
  Lock,
  X,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  Repeat,
  Zap,
  ClipboardPaste
} from 'lucide-react';
import { YoutubeIcon } from './YoutubeIcon';
import { LockedPlaylist } from '../../types';
import {
  fetchYouTubePlaylist,
  FEATURED_YOUTUBE_PLAYLISTS
} from '../../utils/youtubePlaylistHelper';
import { audioEngine } from '../../audio/audioEngine';

interface YouTubePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLockPlaylist: (playlist: LockedPlaylist, autoPlay?: boolean) => void;
  currentLockedPlaylist: LockedPlaylist | null;
  onUnlockPlaylist: () => void;
}

export const YouTubePlaylistModal: React.FC<YouTubePlaylistModalProps> = ({
  isOpen,
  onClose,
  onLockPlaylist,
  currentLockedPlaylist,
  onUnlockPlaylist
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [extractedPlaylist, setExtractedPlaylist] = useState<LockedPlaylist | null>(null);
  const [loopPlaylist, setLoopPlaylist] = useState<boolean>(true);
  const [autoStartMixing, setAutoStartMixing] = useState<boolean>(true);

  if (!isOpen) return null;

  // Instant Mix: Fetches and locks immediately with playback started
  const handleInstantMix = async (targetUrl?: string) => {
    audioEngine.unlockAllAudio();

    const toFetch = targetUrl || urlInput;
    if (!toFetch.trim()) {
      setErrorMessage('Please enter a YouTube link or choose a curated set below.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const res = await fetchYouTubePlaylist(toFetch);
    setIsLoading(false);

    if (res.success && res.playlist) {
      onLockPlaylist(
        {
          ...res.playlist,
          loopPlaylist
        },
        autoStartMixing
      );
      onClose();
    } else {
      setErrorMessage(res.error || 'Failed to extract playlist. Please check link.');
    }
  };

  // Preview tracklist without immediately locking
  const handlePreview = async (targetUrl?: string) => {
    const toFetch = targetUrl || urlInput;
    if (!toFetch.trim()) {
      setErrorMessage('Please enter a YouTube link.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    const res = await fetchYouTubePlaylist(toFetch);
    setIsLoading(false);

    if (res.success && res.playlist) {
      setExtractedPlaylist({ ...res.playlist, loopPlaylist });
      setErrorMessage(null);
    } else {
      setErrorMessage(res.error || 'Failed to extract playlist.');
    }
  };

  const handleApplyLock = () => {
    if (!extractedPlaylist) return;
    onLockPlaylist(
      {
        ...extractedPlaylist,
        loopPlaylist
      },
      autoStartMixing
    );
    onClose();
  };

  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setUrlInput(text);
          setErrorMessage(null);
        }
      }
    } catch {
      // Clipboard denied
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-xl bg-[#121218] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative text-white flex flex-col max-h-[90vh]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Minimal Header */}
        <div className="flex items-center gap-2.5 mb-3">
          <div className="w-8 h-8 rounded-lg bg-red-600/20 border border-red-500/40 text-red-500 flex items-center justify-center shrink-0">
            <YoutubeIcon className="w-4 h-4 text-red-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-headline font-black text-lg text-white">
                YouTube DJ Mode
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FF4D00]/20 text-[#FF4D00] border border-[#FF4D00]/40 font-black">
                EXCLUSIVE LOCK
              </span>
            </div>
            <p className="text-[11px] font-mono text-zinc-400">
              Locks auto-DJ engine strictly to your YouTube playlist
            </p>
          </div>
        </div>

        {/* Active Lock Status Banner (if locked) */}
        {currentLockedPlaylist && (
          <div className="mb-3 p-3 rounded-xl bg-[#FF4D00]/10 border border-[#FF4D00]/40 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Lock className="w-4 h-4 text-[#FF4D00] shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-headline font-bold text-white truncate block">
                  {currentLockedPlaylist.title}
                </span>
                <span className="text-[10px] font-mono text-[#FF4D00]">
                  {currentLockedPlaylist.trackCount} Tracks Locked
                </span>
              </div>
            </div>
            <button
              onClick={() => {
                onUnlockPlaylist();
                setExtractedPlaylist(null);
              }}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono text-white transition-colors cursor-pointer shrink-0"
            >
              Clear Lock
            </button>
          </div>
        )}

        {/* Input Bar */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span>PLAYLIST OR VIDEO URL:</span>
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="text-[#FF4D00] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <ClipboardPaste className="w-3 h-3" />
              <span>Paste</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="https://youtube.com/playlist?list=..."
                value={urlInput}
                onChange={(e) => {
                  setUrlInput(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleInstantMix();
                }}
                className="w-full bg-black/60 border border-white/10 focus:border-[#FF4D00] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono"
              />
            </div>

            <button
              onClick={() => handleInstantMix()}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-[#FF4D00] hover:bg-[#FF5A00] disabled:opacity-50 text-white font-headline font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 shadow-md shadow-[#FF4D00]/25 active:scale-95"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Loading</span>
                </>
              ) : (
                <>
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Load & Mix</span>
                </>
              )}
            </button>

            <button
              onClick={() => handlePreview()}
              disabled={isLoading}
              className="px-3 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-zinc-300 font-headline font-bold text-xs transition-colors cursor-pointer shrink-0 border border-white/10"
            >
              Preview
            </button>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-mono text-[11px]">{errorMessage}</span>
            </div>
          )}

          {/* Curated DJ Sets */}
          <div>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block mb-1">
              CURATED DJ SET PRESETS:
            </span>
            <div className="grid grid-cols-3 gap-2">
              {FEATURED_YOUTUBE_PLAYLISTS.map((set) => (
                <button
                  key={set.id}
                  onClick={() => {
                    setUrlInput(set.url);
                    handleInstantMix(set.url);
                  }}
                  className="p-2 rounded-xl bg-black/40 hover:bg-[#FF4D00]/10 hover:border-[#FF4D00]/40 border border-white/[0.08] text-left transition-colors cursor-pointer group"
                >
                  <p className="font-headline font-bold text-xs text-white group-hover:text-[#FF4D00] truncate">
                    {set.title}
                  </p>
                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mt-0.5">
                    <span>{set.tracksCount} Tracks</span>
                    <span className="text-[#FF4D00]">{set.sampleBpm}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Extracted Playlist Preview */}
        {extractedPlaylist && (
          <div className="mt-3 flex-1 overflow-hidden flex flex-col border-t border-white/[0.08] pt-2.5">
            <div className="flex items-center justify-between mb-2">
              <div className="min-w-0">
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Crate Ready
                </span>
                <h4 className="font-headline font-black text-xs text-white truncate">
                  {extractedPlaylist.title}
                </h4>
              </div>
              <span className="text-[10px] font-mono text-[#FF4D00] font-bold px-2 py-0.5 rounded bg-[#FF4D00]/15 border border-[#FF4D00]/30 tabular-nums">
                {extractedPlaylist.trackCount} Tracks
              </span>
            </div>

            {/* Tracklist Preview */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1 max-h-40 border border-white/[0.06] rounded-xl p-2 bg-black/50">
              {extractedPlaylist.tracks.map((t, index) => (
                <div
                  key={t.id}
                  className="p-1.5 rounded-lg flex items-center justify-between text-xs bg-white/[0.02] border border-white/[0.04]"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <span className="text-[10px] font-mono text-zinc-500 w-4 text-right">
                      {index + 1}.
                    </span>
                    <div className="min-w-0">
                      <p className="font-headline font-bold text-white text-xs truncate">
                        {t.title}
                      </p>
                      <p className="text-[10px] font-mono text-zinc-400 truncate">{t.artist}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] font-mono shrink-0 tabular-nums">
                    <span className="px-1 py-0.2 rounded bg-black/60 text-[#FF4D00] font-bold">
                      {t.bpm} BPM
                    </span>
                    <span className="text-zinc-500">{t.key}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Options & Lock CTA */}
            <div className="flex items-center justify-between py-2 text-xs font-mono text-zinc-400">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={loopPlaylist}
                  onChange={(e) => setLoopPlaylist(e.target.checked)}
                  className="rounded border-zinc-700 text-[#FF4D00] focus:ring-[#FF4D00] cursor-pointer"
                />
                <Repeat className="w-3 h-3 text-[#FF4D00]" />
                <span>Loop Crate</span>
              </label>

              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoStartMixing}
                  onChange={(e) => setAutoStartMixing(e.target.checked)}
                  className="rounded border-zinc-700 text-[#FF4D00] focus:ring-[#FF4D00] cursor-pointer"
                />
                <span>Auto-Start</span>
              </label>
            </div>

            <button
              onClick={handleApplyLock}
              className="w-full py-2.5 px-4 rounded-xl bg-[#FF4D00] hover:bg-[#FF5A00] text-white font-headline font-black text-xs flex items-center justify-center gap-2 shadow-lg shadow-[#FF4D00]/30 active:scale-98 transition-all cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>LOCK DJ CRATE ({extractedPlaylist.trackCount} TRACKS)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
