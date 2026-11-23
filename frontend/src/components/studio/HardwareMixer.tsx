import React from 'react';
import { DeckState } from '../../types';

interface HardwareMixerProps {
  deck1: DeckState;
  deck2: DeckState;
  crossfader: number; // 0.0 (Deck 1) to 1.0 (Deck 2)
  onCrossfaderChange: (val: number) => void;
  onEqChange: (deck: 1 | 2, band: 'low' | 'mid' | 'high', val: number) => void;
  onFilterChange: (deck: 1 | 2, val: number) => void;
}

export const HardwareMixer: React.FC<HardwareMixerProps> = ({
  deck1,
  deck2,
  crossfader,
  onCrossfaderChange,
  onEqChange,
  onFilterChange
}) => {
  return (
    <div className="bg-[#13131C] border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col justify-between w-64 select-none">
      {/* Top Mixer Header */}
      <div className="text-center pb-2 border-b border-white/10">
        <h4 className="text-[11px] font-headline font-bold tracking-widest text-[#FF4D00] uppercase">
          HARDWARE MIXER • 2 CH
        </h4>
      </div>

      {/* 2-Channel EQ & Filter Strips — Identical Symmetric Column Alignment */}
      <div className="grid grid-cols-2 gap-3.5 my-2">
        {/* Channel 1 Strip (Deck 1) */}
        <div className="flex flex-col items-center gap-2 bg-[#181824] p-2.5 rounded-xl border border-white/10 w-full">
          <span className="text-[10px] font-headline font-extrabold text-[#FF4D00]">CH 1</span>

          {/* High EQ */}
          <div className="flex flex-col items-center gap-1 w-full">
            <div className="flex items-center justify-between w-full px-1 text-[9px] font-mono text-slate-400 tabular-nums">
              <span>HI</span>
              <span className="text-[8px] text-slate-500">
                {deck1.eqHigh > 1
                  ? `+${Math.round((deck1.eqHigh - 1) * 6)}dB`
                  : `${Math.round((deck1.eqHigh - 1) * 26)}dB`}
              </span>
            </div>
            <div className="w-full px-1 flex justify-center">
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={deck1.eqHigh}
                onChange={(e) => onEqChange(1, 'high', parseFloat(e.target.value))}
                className="w-full h-1 cursor-pointer"
              />
            </div>
          </div>

          {/* Mid EQ */}
          <div className="flex flex-col items-center gap-1 w-full">
            <div className="flex items-center justify-between w-full px-1 text-[9px] font-mono text-slate-400 tabular-nums">
              <span>MID</span>
              <span className="text-[8px] text-slate-500">
                {deck1.eqMid > 1
                  ? `+${Math.round((deck1.eqMid - 1) * 6)}dB`
                  : `${Math.round((deck1.eqMid - 1) * 26)}dB`}
              </span>
            </div>
            <div className="w-full px-1 flex justify-center">
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={deck1.eqMid}
                onChange={(e) => onEqChange(1, 'mid', parseFloat(e.target.value))}
                className="w-full h-1 cursor-pointer"
              />
            </div>
          </div>

          {/* Low EQ + Kill */}
          <div className="flex flex-col items-center gap-1 w-full">
            <div className="flex items-center justify-between w-full px-1 text-[9px] font-mono text-slate-400 tabular-nums">
              <span>LOW</span>
              <span
                className={`text-[8px] font-bold ${
                  deck1.eqLow === 0 ? 'text-rose-400' : 'text-slate-500'
                }`}
              >
                {deck1.eqLow === 0
                  ? 'KILL'
                  : deck1.eqLow > 1
                  ? `+${Math.round((deck1.eqLow - 1) * 6)}dB`
                  : `${Math.round((deck1.eqLow - 1) * 26)}dB`}
              </span>
            </div>
            <div className="w-full px-1 flex justify-center">
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={deck1.eqLow}
                onChange={(e) => onEqChange(1, 'low', parseFloat(e.target.value))}
                className="w-full h-1 cursor-pointer"
              />
            </div>
            <button
              onClick={() => onEqChange(1, 'low', deck1.eqLow === 0 ? 1.0 : 0.0)}
              className={`text-[8px] font-mono px-2 py-0.5 rounded border w-full transition-all cursor-pointer ${
                deck1.eqLow === 0
                  ? 'bg-rose-950 text-rose-400 border-rose-800 font-black'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              KILL BASS
            </button>
          </div>

          {/* Filter Knob */}
          <div className="flex flex-col items-center gap-1 w-full pt-1 border-t border-slate-800">
            <div className="flex items-center justify-between w-full px-1 text-[9px] font-mono text-cyan-400">
              <span>FILTER</span>
              <span className="text-[8px] text-slate-500">
                {deck1.filter > 0.52 ? 'HPF' : deck1.filter < 0.48 ? 'LPF' : 'FLAT'}
              </span>
            </div>
            <div className="w-full px-1 flex justify-center">
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={deck1.filter}
                onChange={(e) => onFilterChange(1, parseFloat(e.target.value))}
                className="w-full h-1.5 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Channel 2 Strip (Deck 2) — Identical Symmetric Alignment */}
        <div className="flex flex-col items-center gap-2 bg-[#181824] p-2.5 rounded-xl border border-white/10 w-full">
          <span className="text-[10px] font-headline font-extrabold text-[#FFA066]">CH 2</span>

          {/* High EQ */}
          <div className="flex flex-col items-center gap-1 w-full">
            <div className="flex items-center justify-between w-full px-1 text-[9px] font-mono text-slate-400 tabular-nums">
              <span>HI</span>
              <span className="text-[8px] text-slate-500">
                {deck2.eqHigh > 1
                  ? `+${Math.round((deck2.eqHigh - 1) * 6)}dB`
                  : `${Math.round((deck2.eqHigh - 1) * 26)}dB`}
              </span>
            </div>
            <div className="w-full px-1 flex justify-center">
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={deck2.eqHigh}
                onChange={(e) => onEqChange(2, 'high', parseFloat(e.target.value))}
                className="w-full h-1 cursor-pointer"
              />
            </div>
          </div>

          {/* Mid EQ */}
          <div className="flex flex-col items-center gap-1 w-full">
            <div className="flex items-center justify-between w-full px-1 text-[9px] font-mono text-slate-400 tabular-nums">
              <span>MID</span>
              <span className="text-[8px] text-slate-500">
                {deck2.eqMid > 1
                  ? `+${Math.round((deck2.eqMid - 1) * 6)}dB`
                  : `${Math.round((deck2.eqMid - 1) * 26)}dB`}
              </span>
            </div>
            <div className="w-full px-1 flex justify-center">
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={deck2.eqMid}
                onChange={(e) => onEqChange(2, 'mid', parseFloat(e.target.value))}
                className="w-full h-1 cursor-pointer"
              />
            </div>
          </div>

          {/* Low EQ + Kill — Fixed CH2 drift with centered axis */}
          <div className="flex flex-col items-center gap-1 w-full">
            <div className="flex items-center justify-between w-full px-1 text-[9px] font-mono text-slate-400 tabular-nums">
              <span>LOW</span>
              <span
                className={`text-[8px] font-bold ${
                  deck2.eqLow === 0 ? 'text-rose-400' : 'text-slate-500'
                }`}
              >
                {deck2.eqLow === 0
                  ? 'KILL'
                  : deck2.eqLow > 1
                  ? `+${Math.round((deck2.eqLow - 1) * 6)}dB`
                  : `${Math.round((deck2.eqLow - 1) * 26)}dB`}
              </span>
            </div>
            <div className="w-full px-1 flex justify-center">
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={deck2.eqLow}
                onChange={(e) => onEqChange(2, 'low', parseFloat(e.target.value))}
                className="w-full h-1 cursor-pointer"
              />
            </div>
            <button
              onClick={() => onEqChange(2, 'low', deck2.eqLow === 0 ? 1.0 : 0.0)}
              className={`text-[8px] font-mono px-2 py-0.5 rounded border w-full transition-all cursor-pointer ${
                deck2.eqLow === 0
                  ? 'bg-rose-950 text-rose-400 border-rose-800 font-black'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
              }`}
            >
              KILL BASS
            </button>
          </div>

          {/* Filter Knob */}
          <div className="flex flex-col items-center gap-1 w-full pt-1 border-t border-slate-800">
            <div className="flex items-center justify-between w-full px-1 text-[9px] font-mono text-purple-400">
              <span>FILTER</span>
              <span className="text-[8px] text-slate-500">
                {deck2.filter > 0.52 ? 'HPF' : deck2.filter < 0.48 ? 'LPF' : 'FLAT'}
              </span>
            </div>
            <div className="w-full px-1 flex justify-center">
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={deck2.filter}
                onChange={(e) => onFilterChange(2, parseFloat(e.target.value))}
                className="w-full h-1.5 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recessed Hardware Crossfader Section with Clear Bounds */}
      <div className="bg-[#101018] p-3 rounded-2xl border border-white/10 shadow-inner">
        <div className="flex items-center justify-between text-[10px] font-mono mb-2 px-1 tabular-nums">
          <span className={`font-black ${crossfader < 0.4 ? 'text-[#FF4D00]' : 'text-slate-500'}`}>
            DECK 1
          </span>
          <span className="text-slate-400 font-bold bg-[#181824] px-2 py-0.5 rounded border border-white/5">
            X-FADER {Math.round(crossfader * 100)}%
          </span>
          <span className={`font-black ${crossfader > 0.6 ? 'text-[#FFA066]' : 'text-slate-500'}`}>
            DECK 2
          </span>
        </div>

        {/* Recessed Hardware Track Groove */}
        <div className="relative w-full h-10 bg-[#07070B] rounded-xl border border-white/10 px-3 flex items-center shadow-[inset_0_3px_8px_rgba(0,0,0,0.9)]">
          <div className="absolute left-3 right-3 h-1.5 bg-white/10 rounded-full flex items-center justify-center pointer-events-none">
            <div className="w-0.5 h-3.5 bg-white/40 rounded-full" />
          </div>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={crossfader}
            onChange={(e) => onCrossfaderChange(parseFloat(e.target.value))}
            className="w-full crossfader-input cursor-pointer relative z-10"
          />
        </div>

        {/* Quick Bounds Buttons */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/[0.06] text-[9px] font-mono">
          <button
            onClick={() => onCrossfaderChange(0.0)}
            className="text-[#FF4D00] hover:text-white px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] transition-colors cursor-pointer"
          >
            DECK 1
          </button>
          <button
            onClick={() => onCrossfaderChange(0.5)}
            className="text-slate-300 hover:text-white px-2 py-0.5 rounded bg-white/[0.08] border border-white/10 transition-colors cursor-pointer font-bold"
          >
            CENTER
          </button>
          <button
            onClick={() => onCrossfaderChange(1.0)}
            className="text-[#FFA066] hover:text-white px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] transition-colors cursor-pointer"
          >
            DECK 2
          </button>
        </div>
      </div>
    </div>
  );
};
