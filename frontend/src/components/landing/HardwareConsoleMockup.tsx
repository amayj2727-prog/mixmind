import React, { useState, useEffect } from 'react';
import { Disc3, Zap, Sliders, Volume2, Activity } from 'lucide-react';

export const HardwareConsoleMockup: React.FC = () => {
  const [crossfaderPos, setCrossfaderPos] = useState<number>(45);
  const [vuLevel1, setVuLevel1] = useState<number>(75);
  const [vuLevel2, setVuLevel2] = useState<number>(60);
  const [isRotating, setIsRotating] = useState<boolean>(true);

  // Subtle live hardware simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setVuLevel1(Math.floor(65 + Math.random() * 30));
      setVuLevel2(Math.floor(55 + Math.random() * 35));
    }, 180);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full relative select-none">
      {/* Decorative Glowing Accent Behind Console */}
      <div className="absolute -inset-1 bg-gradient-to-r from-[#FF4D00]/20 via-transparent to-[#FF4D00]/10 rounded-[36px] blur-2xl pointer-events-none" />

      {/* Main Hardware Chassis */}
      <div className="relative bg-[#111116] border border-white/[0.12] rounded-3xl p-5 sm:p-7 shadow-[0_30px_90px_rgba(0,0,0,0.85)] flex flex-col gap-6">
        {/* Chassis Top Plate Branding & Status LEDs */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 text-xs font-mono">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF4D00] shadow-[0_0_10px_#FF4D00] animate-pulse" />
            <span className="font-headline font-black text-white tracking-wider text-xs">
              MIXMIND • CONSOLE X-1
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-400 font-mono">
              32-BEAT PHRASE SYNC ACTIVE
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-zinc-400 text-[11px]">
            <span className="flex items-center gap-1 text-emerald-400">
              <Activity className="w-3 h-3" />
              <span>48kHz DSP</span>
            </span>
            <span>•</span>
            <span className="text-[#FF4D00] font-bold">DOWNBEAT LOCK</span>
          </div>
        </div>

        {/* Console Working Surface: Deck 1 | Center Mixer | Deck 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          
          {/* DECK 1 MODULE */}
          <div className="lg:col-span-5 bg-[#16161D] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col items-center relative overflow-hidden">
            <div className="w-full flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-3">
              <span className="px-2 py-0.5 rounded bg-[#FF4D00]/20 text-[#FF4D00] font-black">
                DECK 1 (MASTER)
              </span>
              <span className="text-white font-bold tabular-nums">128.0 BPM</span>
            </div>

            {/* Deck 1 Platter */}
            <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full border-4 border-[#242432] p-2 flex items-center justify-center shadow-inner shadow-black/80 bg-[#0E0E13]">
              <div
                className={`w-full h-full rounded-full border border-white/10 flex items-center justify-center relative ${
                  isRotating ? 'vinyl-rotating' : ''
                }`}
              >
                <div className="w-24 h-24 rounded-full border border-white/[0.08] flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-[#FF4D00] text-white flex items-center justify-center shadow-[0_0_20px_rgba(255,77,0,0.4)]">
                    <Disc3 className="w-6 h-6 text-white" />
                  </div>
                </div>
              </div>
              <div className="absolute -top-1 px-2 py-0.5 rounded-full bg-[#0D0D11] border border-white/15 text-[10px] font-mono text-white font-bold">
                8A • D MINOR
              </div>
            </div>

            <div className="mt-3 text-center">
              <p className="font-headline font-bold text-xs text-white truncate max-w-[180px]">
                Anyma, LISA - Bad Angel
              </p>
              <p className="text-[10px] text-zinc-400 font-body">YouTube Track #1</p>
            </div>
          </div>

          {/* CENTER HARDWARE MIXER */}
          <div className="lg:col-span-2 bg-[#14141A] border border-white/[0.08] rounded-2xl p-3 flex flex-col items-center justify-between gap-4 h-full">
            <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-black">
              MIXER
            </span>

            {/* Rotary EQ Knobs */}
            <div className="flex flex-col gap-2.5 w-full items-center">
              {[
                { label: 'HI', val: '+0dB', rot: 0 },
                { label: 'MID', val: '+1dB', rot: 15 },
                { label: 'LOW', val: '-40dB (SWAP)', rot: -45, active: true }
              ].map((knob) => (
                <div key={knob.label} className="flex items-center justify-between w-full px-2 text-[10px] font-mono">
                  <span className="text-zinc-400">{knob.label}</span>
                  <div
                    className={`w-7 h-7 rounded-full border flex items-center justify-center shadow-md relative ${
                      knob.active
                        ? 'border-[#FF4D00] bg-[#FF4D00]/15 text-[#FF4D00]'
                        : 'border-white/20 bg-[#1D1D26] text-white'
                    }`}
                  >
                    <div className="w-1 h-3 bg-[#FF4D00] rounded-full absolute -top-0.5" />
                  </div>
                </div>
              ))}
            </div>

            {/* Dual Stereo LED VU Meters */}
            <div className="flex items-center gap-2 py-1">
              <div className="w-2 h-16 bg-[#0E0E12] rounded flex flex-col-reverse p-0.5 gap-0.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-full h-1.5 rounded-xs transition-colors duration-100 ${
                      i < Math.floor(vuLevel1 / 12)
                        ? i >= 6
                          ? 'bg-rose-500 shadow-[0_0_4px_#f43f5e]'
                          : i >= 4
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                        : 'bg-white/[0.06]'
                    }`}
                  />
                ))}
              </div>
              <div className="w-2 h-16 bg-[#0E0E12] rounded flex flex-col-reverse p-0.5 gap-0.5">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-full h-1.5 rounded-xs transition-colors duration-100 ${
                      i < Math.floor(vuLevel2 / 12)
                        ? i >= 6
                          ? 'bg-rose-500 shadow-[0_0_4px_#f43f5e]'
                          : i >= 4
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                        : 'bg-white/[0.06]'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Constant-Power Crossfader Slider */}
            <div className="w-full pt-1">
              <div className="flex items-center justify-between text-[9px] font-mono text-zinc-500 mb-1">
                <span>CH 1</span>
                <span className="text-[#FF4D00]">BLEND</span>
                <span>CH 2</span>
              </div>
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const p = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
                  setCrossfaderPos(p);
                }}
                className="w-full h-4 bg-[#0A0A0E] rounded-md border border-white/10 relative cursor-pointer"
              >
                <div
                  className="w-4 h-full bg-zinc-200 border border-black/40 rounded shadow-md absolute -translate-x-1/2 transition-all duration-75"
                  style={{ left: `${crossfaderPos}%` }}
                >
                  <div className="w-0.5 h-2 bg-black mx-auto mt-0.5" />
                </div>
              </div>
            </div>
          </div>

          {/* DECK 2 MODULE */}
          <div className="lg:col-span-5 bg-[#16161D] border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col items-center relative overflow-hidden">
            <div className="w-full flex items-center justify-between text-[11px] font-mono text-zinc-400 mb-3">
              <span className="px-2 py-0.5 rounded bg-white/[0.08] text-zinc-300 font-black">
                DECK 2 (INCOMING)
              </span>
              <span className="text-white font-bold tabular-nums">128.0 BPM</span>
            </div>

            {/* Deck 2 Platter */}
            <div className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-full border-4 border-[#242432] p-2 flex items-center justify-center shadow-inner shadow-black/80 bg-[#0E0E13]">
              <div
                className={`w-full h-full rounded-full border border-white/10 flex items-center justify-center relative ${
                  isRotating ? 'vinyl-rotating' : ''
                }`}
              >
                <div className="w-24 h-24 rounded-full border border-white/[0.08] flex items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-[#1D1D28] text-zinc-300 flex items-center justify-center shadow-inner border border-white/20">
                    <Disc3 className="w-6 h-6 text-zinc-400" />
                  </div>
                </div>
              </div>
              <div className="absolute -top-1 px-2 py-0.5 rounded-full bg-[#0D0D11] border border-white/15 text-[10px] font-mono text-white font-bold">
                9A • E MINOR
              </div>
            </div>

            <div className="mt-3 text-center">
              <p className="font-headline font-bold text-xs text-white truncate max-w-[180px]">
                Kygo, Khalid - Save My Love
              </p>
              <p className="text-[10px] text-zinc-400 font-body">YouTube Track #2</p>
            </div>
          </div>
        </div>

        {/* Bottom Hardware Patch Bay with Glowing Patch Cables */}
        <div className="border-t border-white/[0.08] pt-3 flex flex-wrap items-center justify-between gap-3 text-[11px] font-mono text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FF4D00]" />
            <span>HARMONIC ROUTING: 8A ➔ 9A (+1 SEMITONE ENERGY BOOST)</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-zinc-500">SUB-BASS ISOLATION: -40dB</span>
            <span className="text-emerald-400 font-bold">DOWNBEAT SYNCED</span>
          </div>
        </div>
      </div>
    </div>
  );
};
