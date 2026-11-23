import React from 'react';
import { Zap, Lock } from 'lucide-react';
import { YoutubeIcon } from '../youtube/YoutubeIcon';
import { Track, LockedPlaylist } from '../../types';

interface StudioHeaderProps {
  activeMasterDeck: 1 | 2;
  masterTrack: Track | null;
  autoDjCountdown: number;
  blendIntervalSeconds: number;
  onBlendIntervalChange: (sec: number) => void;
  isTransitionExecuting: boolean;
  onTriggerTransition: () => void;
  onSkipTrack: () => void;
  autoDjPaused: boolean;
  onTogglePause: () => void;
  lockedPlaylist?: LockedPlaylist | null;
  onUnlockPlaylist?: () => void;
  onOpenYouTubeModal?: () => void;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  activeMasterDeck,
  masterTrack,
  autoDjCountdown,
  blendIntervalSeconds,
  onBlendIntervalChange,
  isTransitionExecuting,
  onTriggerTransition,
  onSkipTrack,
  autoDjPaused,
  onTogglePause,
  lockedPlaylist,
  onUnlockPlaylist,
  onOpenYouTubeModal
}) => {
  return (
    <div className="w-full bg-[#12121A] border-y border-[#FF4D00]/25 px-4 py-2 flex flex-wrap items-center justify-between gap-3 shadow-md select-none text-xs font-mono">
      {/* Left: Auto DJ Status + On Air Track + Vocal Hook Telemetry */}
      <div className="flex items-center gap-3 min-w-0 flex-wrap sm:flex-nowrap">
        <div className="flex items-center gap-2 shrink-0">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF4D00] opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF4D00]" />
          </span>
          <span className="text-[11px] font-headline font-black text-[#FF4D00] tracking-wider uppercase">
            AUTO DJ
          </span>
        </div>

        {/* Locked Playlist Telemetry Badge */}
        {lockedPlaylist ? (
          <div className="flex items-center gap-2 px-2.5 py-0.5 rounded-lg bg-[#FF4D00]/20 border border-[#FF4D00]/50 text-white shrink-0">
            <Lock className="w-3 h-3 text-[#FF4D00]" />
            <span className="text-[10px] font-headline font-extrabold text-[#FF4D00] truncate max-w-[150px] sm:max-w-[200px]">
              {lockedPlaylist.title}
            </span>
            <span className="text-[10px] tabular-nums text-zinc-300">
              ({lockedPlaylist.trackCount})
            </span>
            {onUnlockPlaylist && (
              <button
                onClick={onUnlockPlaylist}
                className="text-[9px] px-1.5 py-0.2 rounded bg-black/40 hover:bg-black text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Unlock playlist pool"
              >
                UNLOCK
              </button>
            )}
          </div>
        ) : onOpenYouTubeModal ? (
          <button
            onClick={onOpenYouTubeModal}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-red-950/30 hover:bg-red-900/40 border border-red-500/30 text-red-300 hover:text-white text-[10px] font-mono transition-colors cursor-pointer shrink-0"
            title="Lock engine to a YouTube Playlist"
          >
            <YoutubeIcon className="w-3 h-3 text-red-500" />
            <span>YOUTUBE DJ</span>
          </button>
        ) : null}

        <div className="h-3.5 w-px bg-white/10 hidden sm:block shrink-0" />

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-slate-400">ON AIR:</span>
          <span className="px-1.5 py-0.2 rounded bg-[#FF4D00]/20 text-[#FF4D00] font-bold border border-[#FF4D00]/30 text-[10px] tabular-nums">
            DECK {activeMasterDeck}
          </span>
          <span className="text-white font-bold truncate max-w-[160px] sm:max-w-[200px]">
            {masterTrack?.title || 'Playing...'}
          </span>
        </div>

        {/* Vocal Hook Telemetry */}
        {masterTrack?.hookStatement && (
          <div className="hidden xl:flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] truncate max-w-sm">
            <span className="font-black text-amber-400 shrink-0">HOOK:</span>
            <span className="italic truncate">"{masterTrack.hookStatement}"</span>
          </div>
        )}
      </div>

      {/* Center: Next Blend Countdown & Play Duration Selector */}
      <div className="flex items-center gap-2.5 flex-1 max-w-md mx-auto justify-center">
        <div className="text-[10px] text-slate-400 whitespace-nowrap">
          NEXT BLEND:{' '}
          <span className="text-[#FF4D00] font-bold text-xs tabular-nums">
            {autoDjCountdown}s
          </span>
        </div>
        <div className="w-28 sm:w-36 bg-black rounded-full h-1.5 overflow-hidden border border-white/10 shrink-0">
          <div
            className="bg-[#FF4D00] h-full transition-all duration-1000 shadow-sm shadow-[#FF4D00]"
            style={{
              width: `${Math.max(
                0,
                Math.min(100, (autoDjCountdown / blendIntervalSeconds) * 100)
              )}%`
            }}
          />
        </div>

        {/* Duration Options */}
        <div className="hidden sm:flex items-center gap-1 bg-[#1A1A24] p-0.5 rounded-lg border border-white/10 text-[9px] tabular-nums">
          {[
            { label: '60s', val: 60 },
            { label: '90s', val: 90 },
            { label: '2M', val: 120 },
            { label: 'Full', val: 240 }
          ].map((opt) => (
            <button
              key={opt.val}
              onClick={() => onBlendIntervalChange(opt.val)}
              className={`px-1.5 py-0.5 rounded font-bold transition-all cursor-pointer ${
                blendIntervalSeconds === opt.val
                  ? 'bg-[#FF4D00] text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Right: Auto DJ Controls */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onTriggerTransition}
          disabled={isTransitionExecuting}
          className="px-3 py-1 rounded-lg bg-[#FF4D00] hover:bg-[#FF6622] text-white text-[11px] font-headline font-black flex items-center gap-1 shadow-sm shadow-[#FF4D00]/30 active:scale-95 transition-all cursor-pointer"
        >
          <Zap className="w-3 h-3 fill-white" />
          <span>{isTransitionExecuting ? 'MIXING...' : 'MIX NOW'}</span>
        </button>
        <button
          onClick={onSkipTrack}
          disabled={isTransitionExecuting}
          className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 text-[11px] font-headline font-bold border border-white/10 transition-all cursor-pointer"
        >
          SKIP
        </button>
        <button
          onClick={onTogglePause}
          className={`px-2.5 py-1 rounded-lg text-[11px] font-headline font-bold border transition-all cursor-pointer ${
            autoDjPaused
              ? 'bg-amber-950 text-amber-300 border-amber-800'
              : 'bg-white/[0.04] text-slate-400 border-white/10 hover:text-white'
          }`}
        >
          {autoDjPaused ? 'RESUME' : 'PAUSE'}
        </button>
      </div>
    </div>
  );
};
