import React from 'react';
import { Layers, Sparkles, Play } from 'lucide-react';
import { MashupProposal } from '../types';

interface LiveMashupPanelProps {
  proposals: MashupProposal[];
  onLaunchMashup: (proposal: MashupProposal) => void;
  manualTakeover: boolean;
}

export const LiveMashupPanel: React.FC<LiveMashupPanelProps> = ({
  proposals,
  onLaunchMashup,
  manualTakeover
}) => {
  return (
    <div className="bg-[#13131C] border border-white/10 rounded-2xl p-4 shadow-2xl select-none">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#FF4D00]" />
          <h3 className="text-xs font-mono font-bold tracking-wider text-slate-100 uppercase">
            LIVE MASHUP ENGINE • 4-STEM HARMONIC OVERLAY
          </h3>
        </div>
        <span className="text-[10px] font-mono text-[#FF4D00] bg-[#FF4D00]/10 px-2 py-0.5 rounded border border-[#FF4D00]/30 flex items-center gap-1 font-bold">
          <Sparkles className="w-3 h-3" />
          STEM ISOLATION ACTIVE
        </span>
      </div>

      {/* Proposals Cards */}
      <div className="space-y-3">
        {proposals.map((prop) => (
          <div
            key={prop.proposalId}
            className="bg-[#181824] p-3 rounded-xl border border-white/5 hover:border-white/15 transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-slate-100 font-mono">{prop.title}</h4>
                <p className="text-[11px] text-slate-400 mt-1 leading-snug">{prop.explanation}</p>
              </div>

              <button
                onClick={() => onLaunchMashup(prop)}
                disabled={manualTakeover}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shrink-0 shadow-md transition-all cursor-pointer ${
                  manualTakeover
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-[#FF4D00] hover:bg-[#FF5500] text-white shadow-[#FF4D00]/30 active:scale-95'
                }`}
              >
                <Play className="w-3 h-3 fill-current" />
                LAUNCH MASHUP
              </button>
            </div>

            {/* Stem Routing & Alignment Footprint */}
            <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2 border-t border-white/5 text-[10px] font-mono">
              <div className="bg-[#121624] p-1.5 rounded border border-white/5 flex items-center justify-between">
                <span className="text-[#FF4D00] font-bold">D1 GROOVE:</span>
                <span className="text-slate-300">Vocal 0% • Bass 100% • Drums 100%</span>
              </div>
              <div className="bg-[#121624] p-1.5 rounded border border-white/5 flex items-center justify-between">
                <span className="text-purple-400 font-bold">D2 ACAPELLA:</span>
                <span className="text-slate-300">Vocal 100% • Bass 0% (16B Loop)</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
