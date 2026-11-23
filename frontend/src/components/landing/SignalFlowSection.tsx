import React from 'react';
import { ArrowRight, Cpu, Disc3, Sliders, Volume2 } from 'lucide-react';
import { YoutubeIcon } from '../youtube/YoutubeIcon';

interface SignalFlowSectionProps {
  onLaunchParty: () => void;
}

export const SignalFlowSection: React.FC<SignalFlowSectionProps> = ({ onLaunchParty }) => {
  const nodes = [
    { num: '01', title: 'SOURCE', desc: 'YouTube / Crate', icon: YoutubeIcon },
    { num: '02', title: 'HARMONIC', desc: 'Camelot Wheel', icon: Cpu },
    { num: '03', title: 'PHRASE', desc: '32-Beat Downbeat', icon: Disc3 },
    { num: '04', title: 'ISOLATOR', desc: '-40dB Bass Swap', icon: Sliders },
    { num: '05', title: 'MASTER', desc: '48kHz Sound', icon: Volume2 }
  ];

  return (
    <section className="py-16 w-full border-t border-white/[0.08]">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 text-left">
        <div>
          <span className="text-[10px] font-mono text-[#FF4D00] tracking-[0.2em] uppercase font-black block mb-1">
            HOW IT WORKS
          </span>
          <h2 className="font-headline font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
            THE SIGNAL FLOW
          </h2>
        </div>
        <button
          onClick={onLaunchParty}
          className="text-xs font-headline font-bold text-[#FF4D00] hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto"
        >
          <span>Launch Mix Session</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Visual Hardware Schematic Pipeline */}
      <div className="w-full bg-[#14141A] border border-white/[0.08] rounded-3xl p-5 sm:p-7 shadow-xl">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 relative">
          {nodes.map((node, index) => {
            const Icon = node.icon;
            const isLast = index === nodes.length - 1;
            return (
              <div
                key={node.num}
                className={`bg-[#181824] border ${
                  isLast ? 'border-[#FF4D00]/50 bg-[#FF4D00]/5' : 'border-white/[0.06]'
                } rounded-2xl p-4 flex flex-col items-center text-center relative group hover:border-[#FF4D00] transition-all`}
              >
                <div className="flex items-center justify-between w-full text-[10px] font-mono mb-2">
                  <span className="text-zinc-500 font-bold">{node.num}</span>
                  <span className={`w-1.5 h-1.5 rounded-full ${isLast ? 'bg-[#FF4D00]' : 'bg-emerald-400'}`} />
                </div>

                <div className="w-10 h-10 rounded-xl bg-[#0E0E14] border border-white/10 flex items-center justify-center my-1 group-hover:scale-105 transition-transform">
                  <Icon className={`w-5 h-5 ${isLast ? 'text-[#FF4D00]' : 'text-zinc-300'}`} />
                </div>

                <h4 className="font-headline font-black text-xs text-white mt-2">
                  {node.title}
                </h4>
                <p className="text-[10px] font-mono text-zinc-400 mt-0.5">
                  {node.desc}
                </p>

                {/* Connecting arrow indicator for wide screens */}
                {!isLast && (
                  <div className="hidden lg:block absolute -right-2 top-1/2 -translate-y-1/2 z-10 text-white/20 font-mono text-xs pointer-events-none">
                    →
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Schematic Footer strip */}
        <div className="mt-5 pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between text-[10px] font-mono text-zinc-500">
          <span>REAL-TIME DETERMINISTIC DSP PIPELINE</span>
          <span className="text-zinc-400 uppercase tracking-widest font-bold">
            ROUTE • QUANTIZE • BASS SWAP • DROP
          </span>
        </div>
      </div>
    </section>
  );
};
