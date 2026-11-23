import React from 'react';
import { Play, Pause, RotateCcw, Repeat } from 'lucide-react';
import { DeckState, StemsState } from '../types';

interface DeckHardwareProps {
  deck: DeckState;
  colorTheme: 'teal' | 'purple';
  onPlayToggle: () => void;
  onCue: () => void;
  onSync: () => void;
  onLoopToggle: (beats: number) => void;
  onPitchChange: (pitch: number) => void;
  onStemChange: (stemName: keyof StemsState, value: number) => void;
}

export const DeckHardware: React.FC<DeckHardwareProps> = ({
  deck,
  colorTheme,
  onPlayToggle,
  onCue,
  onSync,
  onLoopToggle,
  onPitchChange,
  onStemChange
}) => {
  const isTeal = colorTheme === 'teal';

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="bg-[#13131C] border border-white/10 rounded-2xl p-4 shadow-2xl relative flex flex-col justify-between select-none">
      {/* Top Bar: Deck ID, Track Title, Camelot Key, BPM */}
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <span
              className={`text-xs font-headline font-black px-2 py-0.5 rounded ${
                isTeal ? 'bg-[#FF4D00] text-white' : 'bg-purple-600 text-white'
              }`}
            >
              DECK {deck.deck}
            </span>
            <div className="overflow-hidden">
              <h3 className="font-headline font-extrabold text-sm text-white truncate max-w-[200px] sm:max-w-[240px]">
                {deck.track ? deck.track.title : 'No Track Loaded'}
              </h3>
              <p className="font-body text-xs text-slate-400 truncate max-w-[200px] sm:max-w-[240px]">
                {deck.track ? deck.track.artist : 'Waiting for track selection...'}
              </p>
            </div>
          </div>

          {/* Key and BPM Badges with Tabular Numbers */}
          <div className="flex items-center gap-2">
            <div
              className={`px-2 py-1 rounded-md border font-mono font-bold text-xs flex flex-col items-center tabular-nums ${
                isTeal
                  ? 'bg-[#181824] border-white/10 text-[#FF4D00]'
                  : 'bg-[#181824] border-white/10 text-purple-400'
              }`}
            >
              <span className="text-[9px] uppercase tracking-wider text-slate-400">KEY</span>
              <span>{deck.track ? deck.track.key : '--'}</span>
            </div>

            <div className="bg-[#141824] px-3 py-1 rounded-md border border-white/10 font-mono text-right tabular-nums">
              <span className="text-[9px] uppercase tracking-wider text-slate-500 block">BPM</span>
              <span
                className={`text-base font-black ${
                  isTeal ? 'text-[#FF4D00]' : 'text-purple-400'
                }`}
              >
                {deck.bpm.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Track Attributes Sub-bar */}
        {deck.track && (
          <div className="flex items-center justify-between pt-2 text-[10px] font-mono text-slate-400 tabular-nums">
            <span className="bg-white/5 border border-white/5 px-2 py-0.5 rounded">
              {deck.track.genre}
            </span>
            <div className="flex items-center gap-3">
              <span>ENERGY: {(deck.track.energy * 100).toFixed(0)}%</span>
              <span>VOCAL: {(deck.track.vocalPresence * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Platter & Pitch Slider */}
      <div className="my-4 flex items-center justify-between gap-4">
        {/* Jog Platter Wheel with Time Display */}
        <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
          <div
            className={`absolute inset-0 rounded-full border-2 border-dashed ${
              isTeal ? 'border-[#FF4D00]/50' : 'border-purple-500/50'
            } ${deck.isPlaying ? 'platter-rotating' : ''}`}
          />

          <div className="w-28 h-28 rounded-full bg-[#10131D] border border-white/10 shadow-inner flex flex-col items-center justify-center p-2 relative">
            <div className="absolute top-1 w-1 h-3 bg-[#FF4D00] rounded-full shadow-sm" />

            <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-1">
              {deck.isPlaying ? 'PLAYING' : 'PAUSED'}
            </span>
            <span className="text-sm font-mono font-bold text-white tracking-wider my-0.5 tabular-nums">
              {formatTime(deck.timeElapsed)}
            </span>
            <span className="text-[9px] font-mono text-slate-400 tabular-nums">
              -{formatTime(deck.timeRemaining)}
            </span>
          </div>
        </div>

        {/* Pitch / Tempo Slider */}
        <div className="flex flex-col items-center gap-1 bg-[#10131E] p-2 rounded-xl border border-white/10 h-36 justify-between w-12">
          <span className="text-[8px] font-mono text-slate-400">PITCH</span>
          <div className="relative h-24 flex items-center">
            <input
              type="range"
              min="-8"
              max="8"
              step="0.1"
              value={deck.pitchPct}
              onChange={(e) => onPitchChange(parseFloat(e.target.value))}
              className="vertical-slider cursor-pointer"
            />
          </div>
          <span className="text-[9px] font-mono text-white font-bold tabular-nums">
            {deck.pitchPct > 0 ? `+${deck.pitchPct.toFixed(1)}` : deck.pitchPct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* 4-Stem Isolation Switches */}
      <div className="bg-[#10131D] p-2 rounded-xl border border-white/10 my-2">
        <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mb-1.5 px-1">
          <span>4-STEM ISOLATOR</span>
          <span className="text-[#FF4D00] font-bold">REALTIME MUTE</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {(['vocal', 'instruments', 'bass', 'drums'] as (keyof StemsState)[]).map((stem) => {
            const isMuted = deck.stems[stem] === 0;
            return (
              <button
                key={stem}
                onClick={() => onStemChange(stem, isMuted ? 1.0 : 0.0)}
                className={`py-1 px-1 rounded text-[9px] font-mono font-bold border transition-all cursor-pointer ${
                  !isMuted
                    ? 'bg-white/10 text-white border-white/20'
                    : 'bg-rose-950/70 text-rose-400 border-rose-800'
                }`}
              >
                {stem === 'instruments' ? 'INST' : stem.toUpperCase()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Primary Hardware Transport Controls */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
        <div className="flex items-center gap-2">
          <button
            onClick={onPlayToggle}
            className={`w-12 h-12 rounded-xl flex items-center justify-center font-black transition-all cursor-pointer active:scale-95 shadow-md ${
              deck.isPlaying
                ? 'bg-[#FF4D00] text-white shadow-[#FF4D00]/30'
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
            }`}
            title="Play / Pause"
          >
            {deck.isPlaying ? (
              <Pause className="w-5 h-5 fill-white" />
            ) : (
              <Play className="w-5 h-5 fill-white ml-0.5" />
            )}
          </button>

          <button
            onClick={onCue}
            className="w-12 h-12 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 flex flex-col items-center justify-center font-mono text-[10px] font-bold active:scale-95 cursor-pointer"
            title="CUE: Seek to Start"
          >
            <RotateCcw className="w-4 h-4 mb-0.5 text-amber-400" />
            CUE
          </button>
        </div>

        {/* Sync & Auto-Loop Triggers */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={onSync}
            className="px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-mono font-bold active:scale-95 cursor-pointer"
            title="Tempo Beat Sync"
          >
            SYNC
          </button>

          <button
            onClick={() => onLoopToggle(deck.loopActive ? 0 : 4)}
            className={`px-2.5 py-2 rounded-xl border text-[10px] font-mono font-bold flex items-center gap-1 active:scale-95 cursor-pointer ${
              deck.loopActive
                ? 'bg-amber-500 text-black border-amber-400 font-black'
                : 'bg-white/5 text-slate-300 border-white/10 hover:text-white'
            }`}
          >
            <Repeat className="w-3 h-3" />
            {deck.loopActive ? `${deck.loopLengthBeats}B LOOP` : '4B LOOP'}
          </button>
        </div>
      </div>
    </div>
  );
};
