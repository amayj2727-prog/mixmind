import React, { useState, useRef } from 'react';
import {
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  Zap,
  Music,
  Search,
  Lock,
  Plus,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Flame,
  Radio,
  Clock
} from 'lucide-react';
import { YoutubeIcon } from '../youtube/YoutubeIcon';
import { Track, LockedPlaylist } from '../../types';
import { processAudioFile } from '../../utils/audioFileHelper';
import { audioEngine } from '../../audio/audioEngine';

interface PartyDeckProps {
  currentTrack: Track | null;
  incomingTrack: Track | null;
  isPlaying: boolean;
  onPlayToggle: () => void;
  timeElapsed: number;
  duration: number;
  onSeek: (seconds: number) => void;
  nextBlendCountdown: number;
  blendIntervalSeconds: number;
  onBlendIntervalChange: (seconds: number) => void;
  onTriggerInstantMix: () => void;
  onSkipNextTrack: () => void;
  isTransitionExecuting: boolean;
  libraryTracks: Track[];
  lockedPlaylist?: LockedPlaylist | null;
  onUnlockPlaylist?: () => void;
  onOpenYouTubeModal?: () => void;
  onSelectNextTrack: (track: Track) => void;
  onAddTracks?: (tracks: Track[]) => void;
  currentEnergy: number;
  onEnergyChange: (energyVal: number) => void;
  onTriggerAirhorn: () => void;
  onTriggerSpinback: () => void;
  onTriggerSubDrop: () => void;
  onTriggerEchoFreeze: () => void;
}

export const PartyDeck: React.FC<PartyDeckProps> = ({
  currentTrack,
  incomingTrack,
  isPlaying,
  onPlayToggle,
  timeElapsed,
  duration,
  onSeek,
  nextBlendCountdown,
  blendIntervalSeconds,
  onBlendIntervalChange,
  onTriggerInstantMix,
  onSkipNextTrack,
  isTransitionExecuting,
  libraryTracks,
  lockedPlaylist,
  onUnlockPlaylist,
  onOpenYouTubeModal,
  onSelectNextTrack,
  onAddTracks,
  currentEnergy: _currentEnergy,
  onEnergyChange: _onEnergyChange,
  onTriggerAirhorn,
  onTriggerSpinback,
  onTriggerSubDrop,
  onTriggerEchoFreeze
}) => {
  const [showLibrary, setShowLibrary] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePad, setActivePad] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handlePadTrigger = (id: string, fn: () => void) => {
    setActivePad(id);
    fn();
    setTimeout(() => setActivePad(null), 300);
  };

  const handleFilesSelected = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const audioFiles = fileArray.filter(
      (f) => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(f.name)
    );
    if (audioFiles.length === 0) return;
    const processed = await Promise.all(audioFiles.map(processAudioFile));
    if (onAddTracks) {
      onAddTracks(processed);
    }
  };

  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (timeElapsed / duration) * 100)) : 0;
  const filteredTracks = libraryTracks.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-6 py-4 select-none font-body text-white">
      {/* MAIN CONTAINER: Sleek, friendly dark glassmorphism */}
      <div className="bg-[#121218]/90 backdrop-blur-xl border border-white/[0.08] rounded-3xl p-5 sm:p-8 shadow-2xl relative overflow-hidden flex flex-col gap-6">
        
        {/* TOP STATUS / QUICK BAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
          {/* Track Telemetry Badge */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-white/[0.08] text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-[#FF4D00] animate-pulse" />
              <span className="font-bold text-[#FF4D00]">{currentTrack?.bpm || 128} BPM</span>
              <span className="text-zinc-500">•</span>
              <span className="text-zinc-300 font-semibold">{currentTrack?.key || '8B'}</span>
            </div>

            {/* AI DJ Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FF4D00]/10 border border-[#FF4D00]/25 text-[11px] font-headline font-bold text-[#FF4D00]">
              <Sparkles className="w-3 h-3 text-[#FF4D00]" />
              <span>AI DJ ACTIVE</span>
            </div>
          </div>

          {/* YouTube DJ Mode Pill */}
          <div className="flex items-center gap-2">
            {lockedPlaylist ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FF4D00]/15 border border-[#FF4D00]/50 text-xs shadow-sm">
                <Lock className="w-3.5 h-3.5 text-[#FF4D00]" />
                <span className="font-headline font-bold text-white truncate max-w-[150px] sm:max-w-[200px]">
                  {lockedPlaylist.title}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-[#FF4D00] font-bold">
                  {lockedPlaylist.trackCount} Songs
                </span>
                <button
                  onClick={onUnlockPlaylist}
                  className="text-[11px] text-zinc-400 hover:text-white underline ml-1 cursor-pointer"
                >
                  Unlock
                </button>
              </div>
            ) : (
              onOpenYouTubeModal && (
                <button
                  onClick={onOpenYouTubeModal}
                  className="px-3.5 py-1.5 rounded-full bg-red-600/15 hover:bg-red-600/25 border border-red-500/40 text-white text-xs font-headline font-bold flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-sm"
                >
                  <YoutubeIcon className="w-4 h-4 text-red-500" />
                  <span>Mix Any YouTube Music</span>
                </button>
              )
            )}
          </div>

          {/* Auto-Mix Pacing Pill Selector */}
          <div className="flex items-center gap-1 bg-black/60 border border-white/[0.08] rounded-full p-1 text-xs font-mono">
            <span className="text-[10px] uppercase text-zinc-500 px-2 font-bold hidden sm:inline">Pace:</span>
            {[
              { label: '60s', val: 60 },
              { label: '90s', val: 90 },
              { label: '2m', val: 120 },
              { label: 'Full', val: 240 }
            ].map((opt) => (
              <button
                key={opt.val}
                onClick={() => onBlendIntervalChange(opt.val)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  blendIntervalSeconds === opt.val
                    ? 'bg-[#FF4D00] text-white shadow-xs'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* HERO STAGE: Spinning Vinyl Turntable & Now Playing */}
        <div className="flex flex-col items-center justify-center text-center gap-5 my-2">
          {/* Animated Vinyl Platter with Ambient Glow */}
          <div className="relative group">
            {/* Ambient Soundwave Glow */}
            <div
              className={`absolute -inset-4 rounded-full bg-[#FF4D00] blur-2xl opacity-20 transition-opacity duration-700 pointer-events-none ${
                isPlaying ? 'opacity-35 scale-105' : 'opacity-10 scale-95'
              }`}
            />

            {/* Vinyl Record */}
            <div
              className={`w-52 h-52 sm:w-64 sm:h-64 rounded-full vinyl-grooves border-4 border-black/80 shadow-2xl relative flex items-center justify-center transition-all ${
                isPlaying ? 'vinyl-rotating' : ''
              }`}
            >
              {/* Outer Grooves Ring */}
              <div className="absolute inset-2 rounded-full border border-white/5 pointer-events-none" />
              <div className="absolute inset-5 rounded-full border border-white/5 pointer-events-none" />
              <div className="absolute inset-8 rounded-full border border-white/5 pointer-events-none" />

              {/* Center Vinyl Label */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-linear-to-br from-[#FF4D00] to-[#D93D00] shadow-lg flex flex-col items-center justify-center text-white border-4 border-zinc-900 relative">
                <Music className="w-8 h-8 text-white drop-shadow-md" />
                <span className="text-[8px] font-headline font-black uppercase tracking-widest text-white/90 mt-1">
                  MIXMIND
                </span>
                {/* Spindle hole */}
                <div className="w-3.5 h-3.5 rounded-full bg-zinc-950 border border-white/30 absolute" />
              </div>
            </div>
          </div>

          {/* Clean Track Title & Artist */}
          <div className="space-y-1.5 max-w-lg px-4">
            <h2 className="font-headline font-extrabold text-2xl sm:text-3xl text-white tracking-tight truncate">
              {currentTrack?.title || 'Party All Night (Extended)'}
            </h2>
            <p className="font-headline font-medium text-sm sm:text-base text-zinc-400 truncate">
              {currentTrack?.artist || 'Yo Yo Honey Singh'}
            </p>
          </div>

          {/* Interactive Live Waveform Visualizer & Seek Bar */}
          <div className="w-full max-w-md space-y-2">
            {/* Pulsing Visualizer Bars */}
            <div className="h-8 flex items-end justify-center gap-1 px-2">
              {Array.from({ length: 36 }).map((_, i) => {
                const height = isPlaying
                  ? Math.abs(Math.sin(i * 0.45 + timeElapsed * 3.5)) * 22 + 6
                  : 4;
                const isPlayed = i / 36 <= progressPercent / 100;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(4, height)}px`,
                      backgroundColor: isPlayed ? '#FF4D00' : '#272733',
                      boxShadow: isPlayed && isPlaying ? '0 0 6px rgba(255,77,0,0.6)' : 'none'
                    }}
                  />
                );
              })}
            </div>

            {/* Click-to-Seek Scrubber */}
            <div
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                onSeek(pos * duration);
              }}
              className="w-full h-3 bg-black/60 rounded-full overflow-hidden cursor-pointer relative border border-white/10 group py-0.5"
            >
              <div
                className="h-full bg-linear-to-r from-[#FF4D00] to-[#FF6B26] rounded-full transition-all duration-100 relative"
                style={{ width: `${progressPercent}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white rounded-full shadow-md scale-0 group-hover:scale-100 transition-transform" />
              </div>
            </div>

            {/* Time Indicators */}
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400 px-1">
              <span className="text-[#FF4D00] font-bold">{formatTime(timeElapsed)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* PRIMARY TRANSPORT CONTROLS (Centerpiece) */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 mt-1">
            {/* Restart / Cue */}
            <button
              onClick={() => onSeek(0)}
              className="w-12 h-12 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-90"
              title="Restart Track (Cue)"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            {/* Giant Main Play / Pause Button */}
            <button
              onClick={async () => {
                await audioEngine.unlockAllAudio();
                onPlayToggle();
              }}
              className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-2xl ${
                isPlaying
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-2 border-white/20'
                  : 'bg-[#FF4D00] hover:bg-[#FF5A00] text-white shadow-[#FF4D00]/50 animate-pulse'
              }`}
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 fill-white" />
              ) : (
                <Play className="w-9 h-9 fill-white ml-1" />
              )}
            </button>

            {/* Next Song / Skip */}
            <button
              onClick={onSkipNextTrack}
              className="w-12 h-12 rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-90"
              title="Skip to Next Track"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* GLOWING AUTO-MIX TRIGGER BUTTON */}
          <div className="w-full max-w-sm mt-1">
            <button
              onClick={async () => {
                await audioEngine.unlockAllAudio();
                onTriggerInstantMix();
              }}
              disabled={isTransitionExecuting}
              className={`w-full py-3.5 px-6 rounded-2xl font-headline font-black text-sm flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg active:scale-95 border ${
                isTransitionExecuting
                  ? 'bg-[#FF4D00]/30 border-[#FF4D00] text-white animate-pulse'
                  : 'bg-linear-to-r from-[#FF4D00] to-[#E64400] hover:from-[#FF5A00] hover:to-[#FF4D00] border-[#FF4D00]/80 text-white shadow-[#FF4D00]/40'
              }`}
            >
              <Zap className="w-4 h-4 fill-white" />
              <span>
                {isTransitionExecuting
                  ? 'AI BLENDING IN PROGRESS...'
                  : isPlaying
                  ? `MIX NEXT SONG NOW • Auto in ${nextBlendCountdown}s`
                  : 'START AI DJ & MIX'}
              </span>
            </button>
          </div>
        </div>

        {/* UP NEXT PREVIEW CARD */}
        <div className="bg-black/50 border border-white/[0.08] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-inner">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center shrink-0 text-[#FF4D00]">
              <Music className="w-5 h-5" />
            </div>
            <div className="text-left min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-headline font-black text-[#FF4D00] uppercase tracking-wider">
                  UP NEXT
                </span>
                <span className="text-[10px] font-mono text-zinc-500">
                  {incomingTrack?.bpm || 128} BPM • Harmonic Match
                </span>
              </div>
              <p className="font-headline font-bold text-sm text-white truncate max-w-[260px] sm:max-w-xs">
                {incomingTrack?.title || 'High Heels (Extended)'}
              </p>
              <p className="text-xs text-zinc-400 truncate max-w-[260px] sm:max-w-xs">
                {incomingTrack?.artist || 'Jaz Dhami & Yo Yo Honey Singh'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onSkipNextTrack}
              className="px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-headline font-bold text-zinc-300 hover:text-white border border-white/10 transition-all cursor-pointer"
            >
              Change Track
            </button>
            <button
              onClick={async () => {
                await audioEngine.unlockAllAudio();
                onTriggerInstantMix();
              }}
              className="px-3.5 py-1.5 rounded-xl bg-[#FF4D00] hover:bg-[#FF5A00] text-xs font-headline font-black text-white transition-all cursor-pointer shadow-xs active:scale-95"
            >
              Mix In Now
            </button>
          </div>
        </div>

        {/* PARTY DJ FX PADS: 4 Big Instant Crowd Pleasers */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-headline font-bold text-zinc-400 px-1">
            <span className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-[#FF4D00]" />
              <span>PARTY SOUND FX</span>
            </span>
            <span className="text-[10px] font-mono text-zinc-500">TAP FOR INSTANT SOUND</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { id: 'airhorn', label: 'AIRHORN', icon: '📢', fn: onTriggerAirhorn },
              { id: 'spinback', label: 'SPINBACK', icon: '🔄', fn: onTriggerSpinback },
              { id: 'subdrop', label: '808 DROP', icon: '💥', fn: onTriggerSubDrop },
              { id: 'echofreeze', label: 'ECHO FREEZE', icon: '❄️', fn: onTriggerEchoFreeze }
            ].map((pad) => (
              <button
                key={pad.id}
                onClick={() => handlePadTrigger(pad.id, pad.fn)}
                className={`py-3 px-3 rounded-2xl border text-xs font-headline font-black flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-90 shadow-sm ${
                  activePad === pad.id
                    ? 'bg-[#FF4D00] text-white border-[#FF4D00] shadow-[#FF4D00]/50 scale-95'
                    : 'bg-black/50 hover:bg-white/[0.08] border-white/10 text-white'
                }`}
              >
                <span className="text-base">{pad.icon}</span>
                <span>{pad.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* MUSIC CRATE / LIBRARY DRAWER TOGGLE */}
        <div className="border-t border-white/[0.06] pt-3">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowLibrary((prev) => !prev)}
              className="flex items-center gap-2 text-xs font-headline font-bold text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <Music className="w-4 h-4 text-[#FF4D00]" />
              <span>SONG LIBRARY ({libraryTracks.length})</span>
              {showLibrary ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-xs font-headline font-bold text-zinc-300 hover:text-white border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-[#FF4D00]" />
              <span>Import Audio</span>
            </button>
          </div>

          {/* Expandable Music List */}
          {showLibrary && (
            <div className="mt-3 space-y-2.5 animate-in fade-in duration-200">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search songs or artists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 focus:border-[#FF4D00] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                {filteredTracks.map((t) => {
                  const isCurrent = currentTrack?.id === t.id;
                  const isIncoming = incomingTrack?.id === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => onSelectNextTrack(t)}
                      className={`p-2.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                        isCurrent
                          ? 'bg-[#FF4D00]/20 border-[#FF4D00] text-white'
                          : isIncoming
                          ? 'bg-white/[0.1] border-white/30 text-white'
                          : 'bg-black/40 border-white/5 text-zinc-300 hover:border-white/20 hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="min-w-0 pr-2 text-left">
                        <p className="font-headline font-bold text-xs truncate text-white">
                          {t.title}
                        </p>
                        <p className="text-[11px] text-zinc-400 truncate">
                          {t.artist}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-black/80 text-[#FF4D00] font-bold">
                          {t.bpm} BPM
                        </span>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded bg-[#FF4D00] text-white font-bold">
                            PLAYING
                          </span>
                        )}
                        {isIncoming && (
                          <span className="px-1.5 py-0.5 rounded bg-white/20 text-white font-bold">
                            NEXT
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Hidden File Picker */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
          onChange={(e) => {
            if (e.target.files) handleFilesSelected(e.target.files);
            e.target.value = '';
          }}
          className="hidden"
        />
      </div>
    </div>
  );
};
