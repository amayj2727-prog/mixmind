import React from 'react';
import { Sparkles } from 'lucide-react';
import { DJPersonality, EnergyPhase } from '../types';

interface PersonalityAndEnergyProps {
  personalities: DJPersonality[];
  selectedPersonality: DJPersonality;
  onSelectPersonality: (p: DJPersonality) => void;
  energyPhase: EnergyPhase;
  onSelectEnergyPhase: (phase: EnergyPhase) => void;
  currentEnergyValue: number; // 0.0 to 1.0
}

export const PersonalityAndEnergy: React.FC<PersonalityAndEnergyProps> = ({
  personalities,
  selectedPersonality,
  onSelectPersonality,
  energyPhase,
  onSelectEnergyPhase,
  currentEnergyValue
}) => {
  const energyPhases: { id: EnergyPhase; label: string; icon: string; desc: string }[] = [
    { id: 'build', label: 'BUILD', icon: '📈', desc: 'Gradually climb energy and drum density' },
    { id: 'maintain', label: 'MAINTAIN', icon: '⚡', desc: 'Sustain steady floor momentum' },
    { id: 'peak', label: 'PEAK', icon: '🔥', desc: 'High impact drops & festival bangers' },
    { id: 'drop', label: 'DROP', icon: '💥', desc: 'Immediate downbeat bassline release' },
    { id: 'reset', label: 'RESET', icon: '🌊', desc: 'Atmospheric breakdown & tension drop' },
  ];

  return (
    <div className="bg-[#0b0e17] border border-[#1d2335] rounded-2xl p-4 shadow-xl select-none">
      {/* Module Title */}
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-mono font-bold tracking-wider text-slate-200 uppercase">
            DJ PERSONALITY & ENERGY ARCHITECT
          </h3>
        </div>
        <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/80">
          AI INTELLIGENCE CORE
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: DJ Personality Selector */}
        <div>
          <span className="text-[10px] font-mono text-slate-400 block mb-2 uppercase tracking-wider">
            ACTIVE DJ PERSONALITY PROFILE
          </span>
          <div className="grid grid-cols-3 gap-2">
            {personalities.map((p) => {
              const isSelected = p.id === selectedPersonality.id;
              return (
                <button
                  key={p.id}
                  onClick={() => onSelectPersonality(p)}
                  className={`p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'bg-[#181e2e] border-cyan-400 shadow-lg shadow-cyan-500/10'
                      : 'bg-[#10141f] border-slate-800 hover:border-slate-700 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-bold ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                      {p.name}
                    </span>
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: p.color }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 line-clamp-2 leading-tight">
                    {p.tagline}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="mt-2.5 bg-[#0f131f] p-2 rounded-lg border border-slate-800/80 text-[10px] font-mono text-slate-400 flex items-center justify-between">
            <span>PREF BPM: {selectedPersonality.targetBpmRange[0]} - {selectedPersonality.targetBpmRange[1]}</span>
            <span>PHRASE: {selectedPersonality.preferredPhraseLength} BEATS</span>
          </div>
        </div>

        {/* Right: Energy Progression Strategy & Live Meter */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
              SET ENERGY PROGRESSION
            </span>
            <span className="text-xs font-mono font-bold text-amber-400">
              CURRENT RMS: {(currentEnergyValue * 100).toFixed(0)}%
            </span>
          </div>

          {/* Energy Phase Buttons */}
          <div className="grid grid-cols-5 gap-1.5 mb-2.5">
            {energyPhases.map((phase) => {
              const isSelected = energyPhase === phase.id;
              return (
                <button
                  key={phase.id}
                  onClick={() => onSelectEnergyPhase(phase.id)}
                  className={`py-1.5 px-1 rounded-lg border text-center transition-all ${
                    isSelected
                      ? 'bg-amber-500 text-black font-extrabold border-amber-400 shadow-md shadow-amber-500/20'
                      : 'bg-[#10141f] border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-xs block">{phase.icon}</span>
                  <span className="text-[9px] font-mono font-bold block mt-0.5">{phase.label}</span>
                </button>
              );
            })}
          </div>

          {/* Dynamic Energy Bar Gauge */}
          <div className="w-full bg-[#0d1017] rounded-full h-3 border border-slate-800 overflow-hidden p-0.5">
            <div
              className="h-full rounded-full bg-[#FF4D00] transition-all duration-300"
              style={{ width: `${currentEnergyValue * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
