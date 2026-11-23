import React from 'react';
import { ArrowUpRight, Cpu, Disc3, Sparkles, Sliders } from 'lucide-react';
import { YoutubeIcon } from '../youtube/YoutubeIcon';

export const ExploreModulesSection: React.FC = () => {
  const modules = [
    {
      id: '01',
      title: 'PHRASE SYNC',
      badge: 'QUANTIZE',
      caption: '32-beat downbeat lock',
      icon: Disc3,
      accent: 'border-[#FF4D00]/40'
    },
    {
      id: '02',
      title: 'CAMELOT KEY',
      badge: 'HARMONIC',
      caption: 'Zero musical clash',
      icon: Cpu,
      accent: 'border-white/10'
    },
    {
      id: '03',
      title: 'BASS SWAP',
      badge: 'STEM DSP',
      caption: '-40dB low-shelf kill',
      icon: Sliders,
      accent: 'border-white/10'
    },
    {
      id: '04',
      title: 'SOUND FX',
      badge: 'PERFORMANCE',
      caption: 'Airhorns & 808 drops',
      icon: Sparkles,
      accent: 'border-white/10'
    },
    {
      id: '05',
      title: 'YOUTUBE CRATE',
      badge: 'CRATE LOCK',
      caption: 'Strict playlist pool',
      icon: YoutubeIcon,
      accent: 'border-white/10'
    }
  ];

  return (
    <section className="py-16 w-full border-t border-white/[0.08]">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 text-left">
        <div>
          <span className="text-[10px] font-mono text-[#FF4D00] tracking-[0.2em] uppercase font-black block mb-1">
            ARCHITECTURE
          </span>
          <h2 className="font-headline font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
            EXPLORE THE MODULES
          </h2>
        </div>
        <p className="text-xs font-mono text-zinc-400">
          5 integrated algorithmic DSP blocks • 48kHz audio pipeline
        </p>
      </div>

      {/* 5 Compact Modular Cards — Visual & Minimal Text */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {modules.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.id}
              className={`bg-[#14141A] hover:bg-[#181824] border ${m.accent} hover:border-[#FF4D00] p-4 rounded-2xl flex flex-col justify-between transition-all group cursor-default shadow-sm min-h-[140px]`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-zinc-500 font-black">
                  {m.id}
                </span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-zinc-400 uppercase font-bold">
                  {m.badge}
                </span>
              </div>

              {/* Center Hardware Icon with Glow */}
              <div className="my-3 flex items-center justify-center">
                <div className="w-10 h-10 rounded-xl bg-[#0D0D12] border border-white/10 flex items-center justify-center group-hover:border-[#FF4D00]/50 group-hover:bg-[#FF4D00]/10 transition-colors">
                  <Icon className="w-5 h-5 text-zinc-300 group-hover:text-[#FF4D00] transition-colors" />
                </div>
              </div>

              <div className="border-t border-white/[0.06] pt-2 text-left">
                <h3 className="font-headline font-black text-xs text-white group-hover:text-[#FF4D00] transition-colors truncate">
                  {m.title}
                </h3>
                <p className="text-[10px] font-mono text-zinc-400 truncate mt-0.5">
                  {m.caption}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
