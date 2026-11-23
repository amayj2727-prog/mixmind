import React from 'react';
import { DeckState, TransitionPlan } from '../types';
import { Mic, Disc, Zap, Volume2, Lock, Flame } from 'lucide-react';

interface WaveformDisplayProps {
  deck1: DeckState;
  deck2: DeckState;
  transitionPlan: TransitionPlan | null;
  onTriggerAirhorn?: () => void;
  onTriggerSpinback?: (deck: 1 | 2) => void;
  onTriggerSubDrop?: () => void;
  onTriggerEchoFreeze?: (deck: 1 | 2) => void;
  onToggleHookLoop?: (deck: 1 | 2) => void;
}

export const WaveformDisplay: React.FC<WaveformDisplayProps> = ({
  deck1,
  deck2,
  transitionPlan,
  onTriggerAirhorn,
  onTriggerSpinback,
  onTriggerSubDrop,
  onTriggerEchoFreeze,
  onToggleHookLoop
}) => {
  const bars = 80;

  const activeDeck = deck1.isPlaying ? deck1 : deck2;
  const activeDeckNum = deck1.isPlaying ? 1 : 2;
  const currentHook = activeDeck.track?.hookStatement;
  const isNearHook = activeDeck.track?.hookStartSec
    ? Math.abs(activeDeck.timeElapsed - activeDeck.track.hookStartSec) < 18
    : false;

  return (
    <div className="bg-[#13131C] border border-white/10 rounded-2xl p-3.5 shadow-2xl relative overflow-hidden space-y-2 select-none">
      {/* 1. Waveform Header / Legend with Tabular Numbers */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[#FF4D00] font-bold flex items-center gap-1.5 shrink-0">
            <span className="w-2 h-2 rounded-full bg-[#FF4D00] animate-ping" />
            DECK 1 (MASTER)
          </span>
          <span className="text-white/20">•</span>
          <span className="text-white font-bold truncate max-w-[240px]">
            {deck1.track ? `${deck1.track.artist} - ${deck1.track.title}` : 'Empty Deck'}
          </span>
        </div>

        {/* Phrase & Beat Counter */}
        <div className="hidden sm:flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1.5 tabular-nums">
            <span className="text-slate-500">PHRASE:</span>
            <span className="text-white font-bold bg-[#1A1A26] px-2 py-0.5 rounded border border-white/10">
              {Math.floor(deck1.phrasePos / 4) + 1}.{(deck1.phrasePos % 4) + 1} / 8.4
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px]">
            <span className="w-2 h-2 rounded-sm bg-[#FF4D00]" /> Low
            <span className="w-2 h-2 rounded-sm bg-teal-400 ml-1.5" /> Mid
            <span className="w-2 h-2 rounded-sm bg-white ml-1.5" /> High
          </div>
        </div>

        <div className="flex items-center gap-3 min-w-0">
          <span className="text-purple-400 font-bold shrink-0">DECK 2 (INCOMING)</span>
          <span className="text-white/20">•</span>
          <span className="text-white font-bold truncate max-w-[240px]">
            {deck2.track ? `${deck2.track.artist} - ${deck2.track.title}` : 'Empty Deck'}
          </span>
        </div>
      </div>

      {/* 2. Dual Stacked Waveform Canvas */}
      <div className="relative h-28 bg-[#07070B] rounded-xl border border-white/10 overflow-hidden flex flex-col justify-between p-1.5">
        {/* Central Playhead Needle */}
        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-[#FF4D00] z-30 shadow-[0_0_8px_rgba(255,77,0,0.8)] pointer-events-none flex flex-col items-center">
          <div className="w-2.5 h-2.5 bg-[#FF4D00] rotate-45 -mt-1 shadow-sm" />
          <div className="w-0.5 flex-1 bg-[#FF4D00]" />
          <div className="w-2.5 h-2.5 bg-[#FF4D00] rotate-45 -mb-1 shadow-sm" />
        </div>

        {/* Transition Zone Indicator */}
        {transitionPlan && (
          <div className="absolute inset-y-0 right-[25%] w-[26%] bg-[#FF4D00]/10 border-x border-[#FF4D00]/40 z-10 pointer-events-none flex items-center justify-center">
            <span className="text-[10px] font-mono font-black tracking-widest text-[#FF4D00] uppercase px-2.5 py-0.5 rounded bg-black/80 border border-[#FF4D00]/50 shadow-md whitespace-nowrap">
              AI 32-BEAT BLEND ZONE • BASS SWAP
            </span>
          </div>
        )}

        {/* Deck 1 Waveform (Top Half: Vermilion #FF4D00) */}
        <div className="h-[48%] flex items-center justify-center gap-[2px] relative overflow-hidden">
          {Array.from({ length: bars }).map((_, i) => {
            const isPlaying = deck1.isPlaying;
            const seed = (i * 17 + (isPlaying ? Date.now() / 250 : 0)) % 100;
            const h = Math.max(12, Math.sin(i * 0.18) * 38 + (seed % 28));
            const isBeat = i % 4 === 0;
            const isDownbeat = i % 16 === 0;

            return (
              <div
                key={`d1-${i}`}
                className="flex-1 flex flex-col items-center justify-center relative"
                style={{ height: '100%' }}
              >
                {isDownbeat && (
                  <span className="absolute -top-1 w-1 h-1.5 rounded-full bg-white opacity-80" />
                )}
                <div
                  className={`w-full rounded-full transition-all duration-75 ${
                    isDownbeat
                      ? 'bg-[#FF4D00] shadow-[0_0_8px_rgba(255,77,0,0.6)]'
                      : isBeat
                      ? 'bg-[#FF4D00]/80'
                      : 'bg-[#FF4D00]/30'
                  }`}
                  style={{ height: `${h}%` }}
                />
              </div>
            );
          })}
        </div>

        {/* Center Grid Divider */}
        <div className="h-[1px] w-full bg-white/10 flex items-center justify-between px-2 text-[9px] font-mono text-slate-500 z-20">
          <span>-32s (INTRO)</span>
          <span className="text-amber-400 font-bold">🎤 HOOK CUE</span>
          <span className="text-[#FF4D00] font-bold">PLAYHEAD</span>
          <span className="text-emerald-400 font-bold">⚡ DROP CUE</span>
          <span>+32s (OUTRO)</span>
        </div>

        {/* Deck 2 Waveform (Bottom Half: Purple/Orange) */}
        <div className="h-[48%] flex items-center justify-center gap-[2px] relative overflow-hidden">
          {Array.from({ length: bars }).map((_, i) => {
            const isPlaying = deck2.isPlaying;
            const seed = (i * 23 + (isPlaying ? Date.now() / 250 : 0)) % 100;
            const h = Math.max(10, Math.cos(i * 0.22) * 34 + (seed % 24));
            const isBeat = i % 4 === 0;
            const isDownbeat = i % 16 === 0;

            return (
              <div
                key={`d2-${i}`}
                className="flex-1 flex flex-col items-center justify-center relative"
                style={{ height: '100%' }}
              >
                <div
                  className={`w-full rounded-full transition-all duration-75 ${
                    isDownbeat
                      ? 'bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.6)]'
                      : isBeat
                      ? 'bg-purple-500/80'
                      : 'bg-purple-900/40'
                  }`}
                  style={{ height: `${h}%` }}
                />
                {isDownbeat && (
                  <span className="absolute -bottom-1 w-1 h-1.5 rounded-full bg-white opacity-80" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Performance FX & Hook Lock Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10 text-xs font-mono">
        {/* DJ FX Instant Hyper Triggers */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 font-bold hidden sm:inline mr-1">CLUB FX:</span>
          {onTriggerAirhorn && (
            <button
              onClick={onTriggerAirhorn}
              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500 text-amber-300 hover:text-black border border-amber-500/30 font-bold text-[10px] transition-all cursor-pointer active:scale-95"
            >
              📢 AIR HORN
            </button>
          )}
          {onTriggerSubDrop && (
            <button
              onClick={onTriggerSubDrop}
              className="px-2.5 py-1 rounded-lg bg-[#FF4D00]/10 hover:bg-[#FF4D00] text-[#FF4D00] hover:text-white border border-[#FF4D00]/30 font-bold text-[10px] transition-all cursor-pointer active:scale-95"
            >
              💥 808 DROP
            </button>
          )}
          {onTriggerSpinback && (
            <button
              onClick={() => onTriggerSpinback(activeDeckNum as 1 | 2)}
              className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 border border-white/10 font-bold text-[10px] transition-all cursor-pointer active:scale-95"
            >
              🔄 SPINBACK
            </button>
          )}
          {onTriggerEchoFreeze && (
            <button
              onClick={() => onTriggerEchoFreeze(activeDeckNum as 1 | 2)}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500 text-cyan-300 hover:text-black border border-cyan-500/30 font-bold text-[10px] transition-all cursor-pointer active:scale-95"
            >
              ❄️ FREEZE
            </button>
          )}
        </div>

        {/* Vocal Hook & Loop Lock */}
        {currentHook && (
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold ${
              isNearHook ? 'bg-amber-950/80 border-amber-500 text-amber-300' : 'bg-white/5 border-white/10 text-slate-400'
            }`}>
              <Mic className="w-3 h-3 text-amber-400" />
              <span className="truncate max-w-[200px]">"{currentHook}"</span>
            </div>

            {onToggleHookLoop && (
              <button
                onClick={() => onToggleHookLoop(activeDeckNum as 1 | 2)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                  activeDeck.loopActive
                    ? 'bg-[#FF4D00] text-white border-[#FF4D00]'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:text-white'
                }`}
              >
                {activeDeck.loopActive ? 'HOOK LOOPED' : 'LOOP HOOK (8B)'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
