import React from 'react';
import { Play, ArrowRight, ShieldCheck, Waves, GraduationCap } from 'lucide-react';
import { TransitionPlan } from '../types';

interface AiTransitionPanelProps {
  plan: TransitionPlan | null;
  onExecuteTransition: () => void;
  onRejectTransition: () => void;
  isExecuting: boolean;
  manualTakeover: boolean;
}

export const AiTransitionPanel: React.FC<AiTransitionPanelProps> = ({
  plan,
  onExecuteTransition,
  onRejectTransition,
  isExecuting,
  manualTakeover
}) => {
  if (!plan) {
    return (
      <div className="bg-[#13131C] border border-white/10 rounded-2xl p-4 shadow-xl flex items-center justify-center text-slate-500 font-mono text-xs">
        No active transition plan. Select an incoming track to generate a blueprint.
      </div>
    );
  }

  return (
    <div className="bg-[#13131C] border border-white/10 rounded-2xl p-4 shadow-2xl select-none space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Waves className="w-4 h-4 text-[#FF4D00]" />
          <h3 className="text-xs font-mono font-bold tracking-wider text-slate-100 uppercase">
            AI TRANSITION ARCHITECT • 10-POINT BLUEPRINT
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-amber-400 bg-amber-950/70 px-2 py-0.5 rounded border border-amber-600/50 flex items-center gap-1">
            <GraduationCap className="w-3.5 h-3.5" />
            MASTERCLASS TELEMETRY
          </span>
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800 flex items-center gap-1 tabular-nums">
            <ShieldCheck className="w-3 h-3" />
            CONFIDENCE: {(plan.confidenceScore * 100).toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Blueprint Pathway */}
      <div className="bg-[#0E121C] p-3 rounded-xl border border-white/10 space-y-3">
        <div className="flex items-center justify-between gap-2 text-xs">
          {/* Outgoing Track */}
          <div className="bg-[#141926] p-2.5 rounded-lg border border-white/10 flex-1 min-w-0">
            <span className="text-[9px] font-mono text-[#FF4D00] uppercase block font-bold">
              OUTGOING (DECK 1)
            </span>
            <p className="font-bold text-slate-100 truncate">{plan.currentTrack.title}</p>
            <p className="text-[11px] text-slate-400 truncate">{plan.currentTrack.artist}</p>
            <span className="text-[10px] font-mono text-slate-500 mt-1 block tabular-nums">
              {plan.currentTrack.bpm} BPM • {plan.currentTrack.key}
            </span>
          </div>

          <div className="flex flex-col items-center px-2 shrink-0">
            <ArrowRight className="w-4 h-4 text-[#FF4D00] animate-pulse" />
            <span className="text-[9px] font-mono text-slate-400 mt-1 font-bold tabular-nums">
              {plan.durationBeats} BEATS
            </span>
          </div>

          {/* Incoming Track */}
          <div className="bg-[#141926] p-2.5 rounded-lg border border-white/10 flex-1 min-w-0">
            <span className="text-[9px] font-mono text-purple-400 uppercase block font-bold">
              INCOMING (DECK 2)
            </span>
            <p className="font-bold text-slate-100 truncate">{plan.incomingTrack.title}</p>
            <p className="text-[11px] text-slate-400 truncate">{plan.incomingTrack.artist}</p>
            <span className="text-[10px] font-mono text-slate-500 mt-1 block tabular-nums">
              {plan.incomingTrack.bpm} BPM • {plan.incomingTrack.key}
            </span>
          </div>
        </div>

        {/* 10-Point Technical Specifications Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-white/10 text-[10px] font-mono tabular-nums">
          <div className="bg-[#111522] p-1.5 rounded border border-white/10">
            <span className="text-slate-500 block">START CUE</span>
            <span className="text-white font-bold">{plan.recommendedStartTimeSec.toFixed(1)}s</span>
          </div>
          <div className="bg-[#111522] p-1.5 rounded border border-white/10">
            <span className="text-slate-500 block">TARGET BPM</span>
            <span className="text-white font-bold">{plan.targetBpm.toFixed(1)} BPM</span>
          </div>
          <div className="bg-[#111522] p-1.5 rounded border border-white/10">
            <span className="text-slate-500 block">PITCH SHIFT</span>
            <span className="text-white font-bold">{plan.pitchShiftPct.toFixed(1)}%</span>
          </div>
          <div className="bg-[#111522] p-1.5 rounded border border-white/10">
            <span className="text-slate-500 block">DURATION</span>
            <span className="text-white font-bold">
              {plan.durationSeconds.toFixed(1)}s ({plan.durationBeats}B)
            </span>
          </div>
        </div>

        {/* Heuristic Description */}
        <div className="bg-[#121626] p-2.5 rounded-lg border border-white/10 text-[10px] font-mono space-y-1">
          <div className="flex items-center justify-between text-slate-300">
            <span className="font-bold text-[#FF4D00]">STYLE: {plan.style.toUpperCase()}</span>
            <span className="text-slate-400">{plan.keyRelationship}</span>
          </div>
          <p className="text-slate-400 leading-relaxed font-body">{plan.explanation}</p>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onRejectTransition}
          disabled={isExecuting || manualTakeover}
          className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-mono font-bold transition-all cursor-pointer"
        >
          SKIP PLAN
        </button>

        <button
          onClick={onExecuteTransition}
          disabled={isExecuting || manualTakeover}
          className={`px-5 py-2 rounded-lg text-xs font-mono font-black flex items-center gap-2 shadow-lg transition-all cursor-pointer ${
            isExecuting
              ? 'bg-amber-500 text-black animate-pulse'
              : manualTakeover
              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              : 'bg-[#FF4D00] hover:bg-[#FF5500] text-white shadow-[#FF4D00]/25 active:scale-95'
          }`}
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          {isExecuting ? 'BLENDING IN PROGRESS...' : 'APPROVE & EXECUTE TRANSITION'}
        </button>
      </div>
    </div>
  );
};
