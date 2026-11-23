import React, { useState, useRef } from 'react';
import {
  Play,
  Pause,
  Zap,
  SkipForward,
  Music,
  Disc3,
  Search,
  Lock,
  Plus,
  Sliders,
  ChevronDown,
  ChevronUp,
  Volume2,
  Radio,
  Flame,
  Activity
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
  const [showCrate, setShowCrate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePad, setActivePad] = useState<string | null>(null);
  const [deck1Fader, setDeck1Fader] = useState(85);
  const [deck2Fader, setDeck2Fader] = useState(85);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handlePadTrigger = (id: string, fn: () => void) => {
    setActivePad(id);
    fn();
    setTimeout(() => setActivePad(null), 350);
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

  const progressPercent = duration > 0 ? (timeElapsed / duration) * 100 : 0;
  const filteredTracks = libraryTracks.filter(
    (t) =>
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-full max-w-[1400px] mx-auto px-2 sm:px-4 py-3 select-none font-body text-white">
      {/* 1. MASTER HARDWARE CHASSIS */}
      <div className="hardware-chassis rounded-3xl p-3 sm:p-5 relative overflow-hidden">
        {/* Corner Hex Bolts */}
        <div className="absolute top-3 left-3 w-3 h-3 rounded-full hex-screw flex items-center justify-center">
          <div className="w-1.5 h-0.5 bg-zinc-950/80 transform rotate-45" />
        </div>
        <div className="absolute top-3 right-3 w-3 h-3 rounded-full hex-screw flex items-center justify-center">
          <div className="w-1.5 h-0.5 bg-zinc-950/80 transform -rotate-12" />
        </div>
        <div className="absolute bottom-3 left-3 w-3 h-3 rounded-full hex-screw flex items-center justify-center">
          <div className="w-1.5 h-0.5 bg-zinc-950/80 transform rotate-75" />
        </div>
        <div className="absolute bottom-3 right-3 w-3 h-3 rounded-full hex-screw flex items-center justify-center">
          <div className="w-1.5 h-0.5 bg-zinc-950/80 transform rotate-30" />
        </div>

        {/* TOP STATUS BAR / RACKMOUNT BANNER */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-white/[0.08] px-2 sm:px-3">
          {/* Brand & Hardware Series */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-[#FF4D00] flex items-center justify-center shadow-md shadow-[#FF4D00]/40">
                <Activity className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-headline font-black text-sm tracking-wider uppercase text-white">
                MIXMIND <span className="text-[#FF4D00]">MK-IV</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/60 border border-white/10 text-zinc-400 uppercase tracking-widest hidden sm:inline">
                AUTONOMOUS SYSTEM
              </span>
            </div>

            <div className="h-4 w-px bg-white/10 hidden md:block" />

            {/* Master Key & Tempo Readout */}
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
              <span className="px-2 py-0.5 rounded bg-black/80 border border-white/10 text-[#FF4D00] font-bold">
                {currentTrack?.bpm || 128} BPM
              </span>
              <span className="px-2 py-0.5 rounded bg-black/80 border border-white/10 text-zinc-300 font-bold">
                {currentTrack?.key || '8B'}
              </span>
              <span className="text-zinc-500">• 4/4 SYNC</span>
            </div>
          </div>

          {/* Center: YouTube Playlist Exclusive Lock Pill */}
          <div className="flex items-center gap-2">
            {lockedPlaylist ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FF4D00]/15 border border-[#FF4D00]/60 shadow-sm shadow-[#FF4D00]/20">
                <Lock className="w-3.5 h-3.5 text-[#FF4D00]" />
                <span className="text-xs font-headline font-black text-white truncate max-w-[180px] sm:max-w-[260px]">
                  {lockedPlaylist.title}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/80 text-[#FF4D00] font-bold">
                  {lockedPlaylist.trackCount} TRACKS
                </span>
                <button
                  onClick={onUnlockPlaylist}
                  className="text-[11px] font-mono text-zinc-400 hover:text-white underline cursor-pointer ml-1"
                >
                  Unlock
                </button>
              </div>
            ) : (
              onOpenYouTubeModal && (
                <button
                  onClick={onOpenYouTubeModal}
                  className="px-3 py-1.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 text-white border border-red-500/50 text-xs font-headline font-black flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-md"
                >
                  <YoutubeIcon className="w-4 h-4 text-red-500" />
                  <span>Lock YouTube Crate</span>
                </button>
              )
            )}
          </div>

          {/* Right: Pace Selector & Mute */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-black/60 border border-white/10 rounded-xl p-0.5 text-xs font-mono">
              {[
                { label: '60s', val: 60 },
                { label: '90s', val: 90 },
                { label: '2m', val: 120 },
                { label: 'Full', val: 240 }
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => onBlendIntervalChange(opt.val)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    blendIntervalSeconds === opt.val
                      ? 'bg-[#FF4D00] text-white shadow-sm'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 2. THREE-BAY MODULAR HARDWARE CONSOLE */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
          {/* ========================================================= */}
          {/* BAY 1: DECK A (ON-AIR MASTER) — 5 COLS */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 hardware-bay rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 relative">
            {/* Header Telemetry */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span
                    className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                      isPlaying ? 'bg-[#FF4D00] opacity-80' : 'bg-zinc-600'
                    }`}
                  />
                  <span
                    className={`relative inline-flex rounded-full h-3 w-3 ${
                      isPlaying ? 'bg-[#FF4D00] shadow-[0_0_10px_#FF4D00]' : 'bg-zinc-600'
                    }`}
                  />
                </span>
                <span className="font-headline font-black text-sm tracking-wider text-white uppercase">
                  DECK A • {isPlaying ? 'LIVE ON-AIR' : 'PAUSED'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <span className="px-2 py-0.5 rounded bg-black/80 border border-white/10 text-[#FF4D00] font-bold">
                  {currentTrack?.key || '8B'}
                </span>
                <span className="px-2 py-0.5 rounded bg-black/80 border border-white/10 text-zinc-300 font-bold tabular-nums">
                  {currentTrack?.bpm || 128} BPM
                </span>
              </div>
            </div>

            {/* Turntable Section with Dual VU Meters */}
            <div className="flex items-center justify-center gap-4 sm:gap-6 my-1">
              {/* Left VU Meter Ladder */}
              <div className="hidden sm:flex flex-col gap-1 py-1">
                {Array.from({ length: 14 }).map((_, i) => {
                  const active = isPlaying && Math.random() > i / 16;
                  const isRed = i < 3;
                  const isYellow = i >= 3 && i < 6;
                  const color = isRed ? '#EF4444' : isYellow ? '#F59E0B' : '#10B981';
                  return (
                    <div
                      key={i}
                      className="w-2.5 h-1.5 rounded-xs transition-opacity duration-75"
                      style={{
                        backgroundColor: color,
                        opacity: active ? 1 : 0.15
                      }}
                    />
                  );
                })}
              </div>

              {/* High-Precision Motorized Turntable */}
              <div
                className="relative cursor-pointer group"
                onClick={async () => {
                  await audioEngine.unlockAllAudio();
                  onPlayToggle();
                }}
                title={isPlaying ? 'Click to Pause' : 'Click to Play'}
              >
                {/* Outer Strobe Rim */}
                <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-full jog-wheel-outer strobe-ring p-3 flex items-center justify-center">
                  {/* Concentric Vinyl Disc */}
                  <div className="w-full h-full rounded-full vinyl-grooves border-2 border-black/80 flex items-center justify-center relative shadow-inner">
                    <div
                      className={`w-full h-full rounded-full flex items-center justify-center ${
                        isPlaying ? 'vinyl-rotating' : ''
                      }`}
                    >
                      {/* Inner Label Cap with Needle Strobe */}
                      <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-linear-to-b from-[#1C1C26] to-[#0A0A0F] border-2 border-white/10 flex flex-col items-center justify-center relative shadow-2xl">
                        {/* Needle Position Radial Marker */}
                        <div className="absolute top-1 w-1 h-3 bg-[#FF4D00] rounded-full shadow-[0_0_6px_#FF4D00]" />
                        
                        <div className="w-12 h-12 rounded-full bg-[#FF4D00] flex items-center justify-center shadow-lg shadow-[#FF4D00]/50 border-2 border-[#0D0D11]">
                          <Disc3 className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-[9px] font-mono text-zinc-400 mt-1 font-bold">
                          {formatTime(timeElapsed)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Active Illuminated Halo */}
                  <div
                    className={`absolute inset-0 rounded-full ring-2 transition-all duration-300 pointer-events-none ${
                      isPlaying
                        ? 'ring-[#FF4D00] shadow-[0_0_30px_rgba(255,77,0,0.4)]'
                        : 'ring-white/10'
                    }`}
                  />
                </div>
              </div>

              {/* Right VU Meter Ladder */}
              <div className="hidden sm:flex flex-col gap-1 py-1">
                {Array.from({ length: 14 }).map((_, i) => {
                  const active = isPlaying && Math.random() > i / 16;
                  const isRed = i < 3;
                  const isYellow = i >= 3 && i < 6;
                  const color = isRed ? '#EF4444' : isYellow ? '#F59E0B' : '#10B981';
                  return (
                    <div
                      key={i}
                      className="w-2.5 h-1.5 rounded-xs transition-opacity duration-75"
                      style={{
                        backgroundColor: color,
                        opacity: active ? 1 : 0.15
                      }}
                    />
                  );
                })}
              </div>
            </div>

            {/* Track Metadata (Clean, Bold, Zero Text Bloat) */}
            <div className="text-center space-y-1 px-2">
              <h3 className="font-headline font-black text-xl sm:text-2xl text-white tracking-tight truncate">
                {currentTrack?.title || 'Party All Night (Extended)'}
              </h3>
              <p className="font-mono text-xs sm:text-sm text-zinc-400 truncate">
                {currentTrack?.artist || 'Yo Yo Honey Singh'}
              </p>
            </div>

            {/* High-Precision Frequency Waveform Visualizer */}
            <div className="space-y-1.5 bg-black/60 rounded-xl p-2.5 border border-white/[0.06]">
              <div className="w-full h-8 flex items-center justify-center gap-0.5">
                {Array.from({ length: 50 }).map((_, i) => {
                  const height = isPlaying
                    ? Math.sin(i * 0.35 + timeElapsed * 4) * 12 + 14
                    : 4;
                  const isPlayed = i / 50 <= progressPercent / 100;
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-full transition-all duration-75"
                      style={{
                        height: `${Math.max(3, height)}px`,
                        backgroundColor: isPlayed ? '#FF4D00' : '#22222E',
                        boxShadow: isPlayed ? '0 0 4px rgba(255,77,0,0.5)' : 'none'
                      }}
                    />
                  );
                })}
              </div>

              {/* Hairline Seek Scrubber */}
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const pos = (e.clientX - rect.left) / rect.width;
                  onSeek(pos * duration);
                }}
                className="w-full h-2 bg-[#1A1A24] rounded-full overflow-hidden cursor-pointer relative border border-white/10"
              >
                <div
                  className="h-full bg-[#FF4D00] rounded-full transition-all duration-100"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono text-zinc-400 tabular-nums">
                <span className="text-[#FF4D00] font-bold">{formatTime(timeElapsed)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Deck A Transport Hardware Button */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => onSeek(0)}
                className="py-3 px-3 rounded-xl bg-black/60 hover:bg-zinc-800 border border-white/10 text-xs font-headline font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <span>CUE (RETURN)</span>
              </button>

              <button
                onClick={async () => {
                  await audioEngine.unlockAllAudio();
                  onPlayToggle();
                }}
                className={`py-3 px-3 rounded-xl font-headline font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95 ${
                  isPlaying
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-white border border-white/20'
                    : 'bg-[#FF4D00] hover:bg-[#FF5A00] text-white shadow-[#FF4D00]/40 animate-pulse'
                }`}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-white" />
                    <span>PAUSE AI DJ</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-white ml-0.5" />
                    <span>START AI DJ</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* BAY 2: CENTER MIXER & AUTODJ COCKPIT — 2 COLS */}
          {/* ========================================================= */}
          <div className="lg:col-span-2 hardware-bay rounded-2xl p-3 sm:p-4 flex flex-col justify-between gap-3 relative">
            {/* Center Header */}
            <div className="text-center border-b border-white/[0.08] pb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 font-bold">
                PRO 2-CH MIXER
              </span>
            </div>

            {/* Auto-Mix Countdown Telemetry Dial */}
            <div className="bg-black/80 border border-white/10 rounded-xl p-3 text-center space-y-1 shadow-inner">
              <span className="text-[9px] font-mono uppercase tracking-wider text-zinc-400 block">
                AUTOPILOT BLEND
              </span>
              <div className="text-3xl font-mono font-black text-white tabular-nums tracking-tight">
                {nextBlendCountdown}
                <span className="text-xs text-[#FF4D00] font-bold ml-1">S</span>
              </div>
            </div>

            {/* Giant Tactile MIX NOW Master Trigger */}
            <button
              onClick={async () => {
                await audioEngine.unlockAllAudio();
                onTriggerInstantMix();
              }}
              disabled={isTransitionExecuting}
              className={`w-full py-4 rounded-xl font-headline font-black text-xs sm:text-sm flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer border active:scale-95 shadow-xl ${
                isTransitionExecuting
                  ? 'bg-[#FF4D00]/30 border-[#FF4D00] text-white animate-pulse'
                  : 'bg-[#FF4D00] hover:bg-[#FF5A00] border-[#FF4D00] text-white shadow-[#FF4D00]/40'
              }`}
            >
              <Zap className="w-5 h-5 fill-white" />
              <span>
                {isTransitionExecuting
                  ? 'AI BLENDING IN PROGRESS...'
                  : isPlaying
                  ? '⚡ MIX NEXT SONG NOW'
                  : '⚡ START AI DJ & MIX'}
              </span>
            </button>

            {/* Dual Channel EQ Rotary Knobs (VoltageLab Style) */}
            <div className="bg-black/60 border border-white/10 rounded-xl p-2.5 space-y-2">
              <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500 uppercase px-1">
                <span>CH-1 EQ</span>
                <span>CH-2 EQ</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {/* Channel 1 EQ Knobs */}
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full hardware-knob-base border border-white/10 relative flex items-center justify-center shadow-md">
                    <div className="w-0.5 h-3 bg-[#FF4D00] rounded-full absolute top-0.5" />
                  </div>
                  <span className="text-[8px] font-mono text-zinc-400">HI</span>

                  <div className="w-7 h-7 rounded-full hardware-knob-base border border-white/10 relative flex items-center justify-center shadow-md">
                    <div className="w-0.5 h-3 bg-[#FF4D00] rounded-full absolute top-0.5" />
                  </div>
                  <span className="text-[8px] font-mono text-zinc-400">MID</span>

                  <div className="w-7 h-7 rounded-full hardware-knob-base border border-white/10 relative flex items-center justify-center shadow-md">
                    <div className="w-0.5 h-3 bg-[#FF4D00] rounded-full absolute top-0.5" />
                  </div>
                  <span className="text-[8px] font-mono text-zinc-400">LOW</span>
                </div>

                {/* Channel 2 EQ Knobs */}
                <div className="flex flex-col items-center gap-1.5">
                  <div className="w-7 h-7 rounded-full hardware-knob-base border border-white/10 relative flex items-center justify-center shadow-md">
                    <div className="w-0.5 h-3 bg-zinc-400 rounded-full absolute top-0.5" />
                  </div>
                  <span className="text-[8px] font-mono text-zinc-400">HI</span>

                  <div className="w-7 h-7 rounded-full hardware-knob-base border border-white/10 relative flex items-center justify-center shadow-md">
                    <div className="w-0.5 h-3 bg-zinc-400 rounded-full absolute top-0.5" />
                  </div>
                  <span className="text-[8px] font-mono text-zinc-400">MID</span>

                  <div className="w-7 h-7 rounded-full hardware-knob-base border border-white/10 relative flex items-center justify-center shadow-md">
                    <div className="w-0.5 h-3 bg-zinc-400 rounded-full absolute top-0.5" />
                  </div>
                  <span className="text-[8px] font-mono text-zinc-400">LOW</span>
                </div>
              </div>
            </div>

            {/* Magvel Optical Crossfader */}
            <div className="bg-black/60 border border-white/10 rounded-xl p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-[9px] font-mono text-zinc-400 font-bold">
                <span className="text-[#FF4D00]">DECK A</span>
                <span>CROSSFADER</span>
                <span className="text-zinc-400">DECK B</span>
              </div>
              <div className="w-full h-4 hardware-fader-slot rounded relative flex items-center px-1">
                <div
                  className="w-5 h-6 rounded bg-[#FF4D00] border border-white shadow-md absolute transition-all duration-300 -top-1"
                  style={{
                    left: isTransitionExecuting ? '75%' : '8%'
                  }}
                />
              </div>
            </div>

            {/* Performance Hot Pad Matrix (6 MPC Silicone Pads) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500 uppercase px-1">
                <span>HOT FX PADS</span>
                <span>INSTANT</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'airhorn', label: 'AIRHORN', icon: '📢', fn: onTriggerAirhorn },
                  { id: 'spinback', label: 'SPINBACK', icon: '🔄', fn: onTriggerSpinback },
                  { id: 'subdrop', label: '808 DROP', icon: '💥', fn: onTriggerSubDrop },
                  { id: 'echofreeze', label: 'FREEZE', icon: '❄️', fn: onTriggerEchoFreeze }
                ].map((pad) => (
                  <button
                    key={pad.id}
                    onClick={() => handlePadTrigger(pad.id, pad.fn)}
                    className={`py-2 px-1 rounded-xl border text-[9px] font-headline font-black flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer active:scale-90 ${
                      activePad === pad.id
                        ? 'bg-[#FF4D00] text-white border-[#FF4D00] shadow-md shadow-[#FF4D00]/50'
                        : 'bg-black/60 border-white/10 text-zinc-300 hover:text-white hover:border-white/30'
                    }`}
                  >
                    <span className="text-xs">{pad.icon}</span>
                    <span>{pad.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* BAY 3: DECK B (CUED STANDBY / UP NEXT) — 5 COLS */}
          {/* ========================================================= */}
          <div className="lg:col-span-5 hardware-bay rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-4 relative">
            {/* Header Telemetry */}
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-zinc-600" />
                <span className="font-headline font-black text-sm tracking-wider text-zinc-400 uppercase">
                  DECK B • CUED STANDBY
                </span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <span className="px-2 py-0.5 rounded bg-black/80 border border-white/10 text-[#FF4D00] font-bold">
                  {incomingTrack?.key || '9B'}
                </span>
                <span className="px-2 py-0.5 rounded bg-black/80 border border-white/10 text-zinc-400 font-bold tabular-nums">
                  {incomingTrack?.bpm || 128} BPM
                </span>
              </div>
            </div>

            {/* Standby Turntable Platter */}
            <div className="flex items-center justify-center gap-4 sm:gap-6 my-1">
              {/* Left Idle Meter */}
              <div className="hidden sm:flex flex-col gap-1 py-1">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2.5 h-1.5 rounded-xs bg-zinc-800 opacity-25"
                  />
                ))}
              </div>

              {/* Cued Turntable Platter */}
              <div className="relative group">
                <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-full jog-wheel-outer strobe-ring p-3 flex items-center justify-center opacity-85">
                  <div className="w-full h-full rounded-full vinyl-grooves border-2 border-black/80 flex items-center justify-center relative shadow-inner">
                    <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-linear-to-b from-[#1C1C26] to-[#0A0A0F] border-2 border-white/10 flex flex-col items-center justify-center relative shadow-2xl">
                      <div className="w-12 h-12 rounded-full bg-[#1A1A26] flex items-center justify-center border-2 border-[#0D0D11] text-zinc-400">
                        <Music className="w-6 h-6 text-zinc-400" />
                      </div>
                      <span className="text-[9px] font-mono text-zinc-500 mt-1 font-bold">
                        CUED READY
                      </span>
                    </div>
                  </div>
                  <div className="absolute inset-0 rounded-full ring-2 ring-white/10 pointer-events-none" />
                </div>
              </div>

              {/* Right Idle Meter */}
              <div className="hidden sm:flex flex-col gap-1 py-1">
                {Array.from({ length: 14 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-2.5 h-1.5 rounded-xs bg-zinc-800 opacity-25"
                  />
                ))}
              </div>
            </div>

            {/* Upcoming Track Details */}
            <div className="text-center space-y-1 px-2">
              <h3 className="font-headline font-black text-xl sm:text-2xl text-white tracking-tight truncate">
                {incomingTrack?.title || 'High Heels (Extended)'}
              </h3>
              <p className="font-mono text-xs sm:text-sm text-zinc-400 truncate">
                {incomingTrack?.artist || 'Jaz Dhami & Yo Yo Honey Singh'}
              </p>
            </div>

            {/* Standby Waveform Display */}
            <div className="space-y-1.5 bg-black/60 rounded-xl p-2.5 border border-white/[0.06]">
              <div className="w-full h-8 flex items-center justify-center gap-0.5">
                {Array.from({ length: 50 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-full"
                    style={{
                      height: `${((i % 7) + 2) * 2.5}px`,
                      backgroundColor: '#20202C'
                    }}
                  />
                ))}
              </div>

              <div className="w-full h-2 bg-[#1A1A24] rounded-full border border-white/10" />

              <div className="flex items-center justify-between text-xs font-mono text-zinc-500 tabular-nums">
                <span>STANDBY / HARMONIC MATCH</span>
                <span>4:15</span>
              </div>
            </div>

            {/* Deck B Control Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={onSkipNextTrack}
                className="py-3 px-3 rounded-xl bg-black/60 hover:bg-zinc-800 border border-white/10 text-white font-headline font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                title="Skip to next track in playlist"
              >
                <SkipForward className="w-4 h-4 text-[#FF4D00]" />
                <span>SKIP TRACK</span>
              </button>

              <button
                onClick={() => setShowCrate((prev) => !prev)}
                className="py-3 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-white font-headline font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
              >
                <Sliders className="w-4 h-4 text-[#FF4D00]" />
                <span>SWAP TRACK</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 3. LOWER CRATE RACKMOUNT DOCK (Playlist Pool) */}
        {/* ========================================================= */}
        <section className="mt-3 sm:mt-4 bg-black/70 border border-white/10 rounded-2xl p-3 sm:p-4 shadow-xl">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-[#FF4D00]" />
              <h4 className="font-headline font-black text-xs sm:text-sm text-white uppercase tracking-wider">
                {lockedPlaylist
                  ? `LOCKED PLAYLIST CRATE (${filteredTracks.length} SONGS)`
                  : `MUSIC POOL (${filteredTracks.length} SONGS)`}
              </h4>
              {lockedPlaylist && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#FF4D00]/20 text-[#FF4D00] font-bold">
                  STRICT LOCK
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono text-zinc-300 border border-white/10 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-[#FF4D00]" />
                <span>Import Audio</span>
              </button>

              <button
                onClick={() => setShowCrate((prev) => !prev)}
                className="px-3 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono text-zinc-300 border border-white/10 flex items-center gap-1 transition-all cursor-pointer"
              >
                <span>{showCrate ? 'Close Crate' : 'Open Crate'}</span>
                {showCrate ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Expandable Crate View */}
          {showCrate && (
            <div className="pt-3 space-y-2.5 animate-in fade-in duration-150">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter tracks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/80 border border-white/10 focus:border-[#FF4D00] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none font-mono"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
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
                          ? 'bg-white/[0.08] border-white/30 text-white'
                          : 'bg-black/40 border-white/5 text-zinc-300 hover:border-white/20'
                      }`}
                    >
                      <div className="min-w-0 pr-2 text-left">
                        <p className="font-headline font-bold text-xs truncate text-white">
                          {t.title}
                        </p>
                        <p className="text-[10px] font-mono text-zinc-400 truncate">
                          {t.artist}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 text-[10px] font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-black/80 text-[#FF4D00] font-bold">
                          {t.bpm} BPM
                        </span>
                        <span className="text-zinc-400">{t.key}</span>
                        {isCurrent ? (
                          <span className="px-1.5 py-0.5 rounded bg-[#FF4D00] text-white font-black">
                            ON-AIR
                          </span>
                        ) : isIncoming ? (
                          <span className="px-1.5 py-0.5 rounded bg-white/20 text-white font-bold">
                            CUED
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

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
