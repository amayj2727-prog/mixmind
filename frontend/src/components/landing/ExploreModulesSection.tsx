import React, { useState, useEffect } from 'react';
import { ArrowRight, Cpu, Disc3, Sparkles, Sliders, Volume2, CheckCircle2 } from 'lucide-react';
import { YoutubeIcon } from '../youtube/YoutubeIcon';
import { audioEngine } from '../../audio/audioEngine';

interface ExploreModulesSectionProps {
  onLaunchParty?: () => void;
}

export const ExploreModulesSection: React.FC<ExploreModulesSectionProps> = ({ onLaunchParty }) => {
  const [activeModule, setActiveModule] = useState<string>('01');
  const [isPlayingAudio, setIsPlayingAudio] = useState<boolean>(false);

  const modules = [
    {
      id: '01',
      title: 'PHRASE SYNC',
      badge: 'QUANTIZE',
      caption: '32-beat downbeat lock',
      icon: Disc3,
      description: 'Aligns song measures, downbeats, and 32-beat drops mathematically so tracks blend without trainwrecking.',
      actionText: 'Launch Phrase Sync in Party Mode',
      soundType: 'phrase'
    },
    {
      id: '02',
      title: 'CAMELOT KEY',
      badge: 'HARMONIC',
      caption: 'Zero musical clash',
      icon: Cpu,
      description: 'Camelot Wheel harmonic key matching algorithm guarantees musical compatibility between adjacent tracks.',
      actionText: 'Try Harmonic Mixing in Party Mode',
      soundType: 'harmonic'
    },
    {
      id: '03',
      title: 'BASS SWAP',
      badge: 'STEM DSP',
      caption: '-40dB low-shelf kill',
      icon: Sliders,
      description: 'Real-time low-frequency stem crossover. Low frequencies from Deck A are cut at the exact bar Deck B kicks in.',
      actionText: 'Test Bass Swap in Party Mode',
      soundType: 'bass'
    },
    {
      id: '04',
      title: 'SOUND FX',
      badge: 'PERFORMANCE',
      caption: 'Airhorns & 808 drops',
      icon: Sparkles,
      description: 'Low-latency Web Audio soundboard triggering stadium airhorns, tape spinbacks, and sub-bass drops on command.',
      actionText: 'Play Sound FX in Party Mode',
      soundType: 'airhorn'
    },
    {
      id: '05',
      title: 'YOUTUBE CRATE',
      badge: 'CRATE LOCK',
      caption: 'Strict playlist pool',
      icon: YoutubeIcon,
      description: 'Extracts full tracklists and metadata from any public YouTube playlist or mix, locking the AI DJ exclusively to your curation.',
      actionText: 'Mix YouTube Playlists in Party Mode',
      soundType: 'youtube'
    }
  ];

  const currentMod = modules.find((m) => m.id === activeModule) || modules[0];

  useEffect(() => {
    return () => {
      audioEngine.stopAllPreviews();
    };
  }, []);

  const handleModuleClick = async (mod: typeof modules[0]) => {
    setActiveModule(mod.id);
    setIsPlayingAudio(true);
    await audioEngine.playModulePreview(mod.soundType);
    setTimeout(() => setIsPlayingAudio(false), 400);
  };

  const handleLaunchClick = () => {
    audioEngine.stopAllPreviews();
    audioEngine.stopAllFx();
    onLaunchParty?.();
  };

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
          Click any module to test audio & inspect DSP architecture
        </p>
      </div>

      {/* 5 Interactive Clickable Module Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {modules.map((m) => {
          const Icon = m.icon;
          const isSelected = activeModule === m.id;
          return (
            <button
              key={m.id}
              onClick={() => handleModuleClick(m)}
              className={`p-4 rounded-2xl flex flex-col justify-between transition-all group cursor-pointer shadow-md min-h-[145px] text-left border relative overflow-hidden active:scale-95 ${
                isSelected
                  ? 'bg-[#181824] border-[#FF4D00] shadow-[#FF4D00]/25'
                  : 'bg-[#14141A] hover:bg-[#181822] border-white/10 hover:border-white/30'
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 right-0 w-8 h-8 bg-linear-to-bl from-[#FF4D00]/40 to-transparent pointer-events-none" />
              )}

              <div className="flex items-center justify-between w-full">
                <span
                  className={`text-[10px] font-mono font-black ${
                    isSelected ? 'text-[#FF4D00]' : 'text-zinc-500 group-hover:text-zinc-400'
                  }`}
                >
                  {m.id}
                </span>
                <span
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-bold transition-colors ${
                    isSelected
                      ? 'bg-[#FF4D00] text-white'
                      : 'bg-white/[0.06] text-zinc-400 group-hover:text-zinc-300'
                  }`}
                >
                  {m.badge}
                </span>
              </div>

              <div className="my-3 flex items-center justify-center w-full">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-[#FF4D00]/20 border border-[#FF4D00] text-[#FF4D00] shadow-md shadow-[#FF4D00]/30 scale-105'
                      : 'bg-[#0D0D12] border border-white/10 text-zinc-300 group-hover:border-[#FF4D00]/40 group-hover:text-[#FF4D00]'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
              </div>

              <div className="border-t border-white/[0.06] pt-2 w-full">
                <h3
                  className={`font-headline font-black text-xs transition-colors truncate ${
                    isSelected ? 'text-[#FF4D00]' : 'text-white group-hover:text-[#FF4D00]'
                  }`}
                >
                  {m.title}
                </h3>
                <p className="text-[10px] font-mono text-zinc-400 truncate mt-0.5">
                  {m.caption}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected Module Interactive Drawer */}
      <div className="mt-4 bg-[#14141A] border border-[#FF4D00]/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl animate-in fade-in duration-150">
        <div className="flex items-center gap-3.5 text-left">
          <div className="w-10 h-10 rounded-xl bg-[#FF4D00]/15 border border-[#FF4D00]/50 flex items-center justify-center shrink-0 text-[#FF4D00]">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#FF4D00]">
                MODULE {currentMod.id}: {currentMod.title}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/[0.08] text-zinc-300 font-bold">
                {currentMod.badge}
              </span>
            </div>
            <p className="text-xs text-zinc-300 mt-1 max-w-2xl leading-relaxed">
              {currentMod.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0 justify-end">
          <button
            onClick={() => handleModuleClick(currentMod)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-headline font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
              isPlayingAudio
                ? 'bg-[#FF4D00]/20 border-[#FF4D00] text-white'
                : 'bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-white'
            }`}
            title="Test Module Audio"
          >
            <Volume2 className="w-4 h-4 text-[#FF4D00]" />
            <span>Test Tone</span>
          </button>

          {onLaunchParty && (
            <button
              onClick={handleLaunchClick}
              className="px-4 py-2 rounded-xl bg-[#FF4D00] hover:bg-[#FF5A00] text-xs font-headline font-black text-white flex items-center gap-2 transition-all cursor-pointer shadow-md shadow-[#FF4D00]/30 active:scale-95"
            >
              <span>{currentMod.actionText}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
};
