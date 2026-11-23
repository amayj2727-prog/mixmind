import React from 'react';
import { VolumeX, Radio, Share2 } from 'lucide-react';
import { DJMode, VirtualDJConnection } from '../../types';
import { BrandLogo } from '../BrandLogo';

interface TopNavProps {
  currentView: 'landing' | 'party' | 'studio';
  onViewChange: (view: 'party' | 'studio') => void;
  onGoHome?: () => void;
  mode: DJMode;
  onModeChange: (mode: DJMode) => void;
  vdjConnection: VirtualDJConnection;
  manualTakeover: boolean;
  onToggleTakeover: () => void;
  isAudioMuted?: boolean;
  onToggleAudio?: () => void;
  onOpenRecap?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({
  currentView,
  onViewChange,
  onGoHome,
  mode,
  onModeChange,
  vdjConnection,
  manualTakeover,
  onToggleTakeover,
  isAudioMuted = false,
  onToggleAudio,
  onOpenRecap
}) => {
  return (
    <header className="w-full glass-surface border-b border-white/[0.06] py-3.5 px-6 box-border flex items-center justify-between select-none sticky top-0 z-50">
      <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-4">
        {/* Left: Brand */}
        <div
          onClick={onGoHome}
          className="flex-1 flex items-center justify-start cursor-pointer hover:opacity-80 transition-opacity"
          title="MIXMIND Home"
        >
          <BrandLogo variant="header" showTagline={currentView === 'landing'} />
        </div>

        {/* Center: Landing Page Anchor Nav or App Mode Switcher */}
        {currentView === 'landing' ? (
          <nav className="hidden md:flex items-center gap-6 text-xs font-headline font-bold text-zinc-400">
            <a href="#modules" className="hover:text-white transition-colors">
              Modules
            </a>
            <a href="#demos" className="hover:text-white transition-colors">
              Live Demos
            </a>
            <a href="#signal-flow" className="hover:text-white transition-colors">
              Signal Flow
            </a>
            <a href="#stories" className="hover:text-white transition-colors">
              Stories
            </a>
          </nav>
        ) : (
          <div className="bg-[#14141A] p-1 rounded-full border border-white/[0.08] inline-flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => onViewChange('party')}
              className={`h-8 px-4 rounded-full text-xs font-headline font-bold transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center ${
                currentView === 'party'
                  ? 'bg-[#FF4D00] text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Party Mode
            </button>

            <button
              onClick={() => onViewChange('studio')}
              className={`h-8 px-4 rounded-full text-xs font-headline font-bold transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center ${
                currentView === 'studio'
                  ? 'bg-[#FF4D00] text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Pro Studio
            </button>
          </div>
        )}

        {/* Right Controls */}
        <div className="flex-1 flex items-center justify-end gap-2 shrink-0 flex-nowrap">
          {currentView === 'studio' && (
            <div className="hidden md:flex items-center gap-2 flex-nowrap shrink-0">
              {/* Autopilot / Copilot / Manual */}
              <div className="flex items-center gap-0.5 bg-[#14141A] border border-white/[0.08] rounded-lg p-1 text-[10px] font-mono shrink-0">
                {(['autopilot', 'copilot', 'manual'] as DJMode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => onModeChange(m)}
                    className={`px-2.5 py-1 rounded-md uppercase font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      mode === m ? 'bg-[#FF4D00] text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {m.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* VDJ */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14141A] border border-white/[0.08] text-[10px] font-mono text-zinc-400 whitespace-nowrap shrink-0 tabular-nums">
                <Radio className="w-3 h-3 text-emerald-400" />
                <span>VDJ: {vdjConnection.licenseTier}</span>
              </div>

              {/* Emergency Takeover */}
              <button
                onClick={onToggleTakeover}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold border transition-colors whitespace-nowrap cursor-pointer shrink-0 ${
                  manualTakeover
                    ? 'bg-red-500 text-white border-red-400'
                    : 'bg-[#14141A] text-zinc-400 border-white/[0.08] hover:border-red-500/50 hover:text-red-400'
                }`}
              >
                {manualTakeover ? 'RELEASE TAKEOVER' : 'EMERGENCY TAKEOVER'}
              </button>
            </div>
          )}

          {/* Audio toggle */}
          {onToggleAudio && (
            <button
              onClick={onToggleAudio}
              className={`px-3 py-1.5 rounded-lg border text-xs font-headline font-bold flex items-center gap-2 transition-colors cursor-pointer shrink-0 ${
                !isAudioMuted
                  ? 'bg-[#14141A] border-[#FF4D00]/40 text-white'
                  : 'bg-[#14141A] border-white/[0.08] text-zinc-400 hover:text-white'
              }`}
              title="Toggle Master Sound"
            >
              {!isAudioMuted ? (
                <>
                  <div className="flex items-end gap-0.5 h-3 w-3">
                    <span className="w-0.5 bg-[#FF4D00] rounded-full animate-eq-1 h-full" />
                    <span className="w-0.5 bg-[#FF4D00] rounded-full animate-eq-2 h-full" />
                    <span className="w-0.5 bg-[#FF4D00] rounded-full animate-eq-3 h-full" />
                    <span className="w-0.5 bg-[#FF4D00] rounded-full animate-eq-4 h-full" />
                  </div>
                  <span className="font-mono text-[11px] font-bold text-white whitespace-nowrap">
                    SOUND ON
                  </span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-mono text-[11px] font-bold text-zinc-400 whitespace-nowrap">
                    MUTED
                  </span>
                </>
              )}
            </button>
          )}

          {/* Share */}
          {onOpenRecap && (
            <button
              onClick={onOpenRecap}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14141A] hover:bg-white/[0.06] border border-white/[0.08] text-white text-xs font-headline font-bold transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              title="Share Set Recap"
            >
              <Share2 className="w-3.5 h-3.5 text-[#FF4D00]" />
              <span>Share Set</span>
            </button>
          )}

          {/* Landing Action Buttons */}
          {currentView === 'landing' && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => onViewChange('studio')}
                className="hidden sm:inline-flex text-xs font-headline font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                Pro Studio
              </button>
              <button
                onClick={() => onViewChange('party')}
                className="h-9 px-4 rounded-full bg-[#FF4D00] hover:bg-[#E64500] text-white text-xs font-headline font-extrabold flex items-center gap-1.5 transition-all shadow-md shadow-[#FF4D00]/25 cursor-pointer active:scale-98"
              >
                <span>Launch Party</span>
                <span className="text-white/80">→</span>
              </button>
            </div>
          )}

          {/* Status indicator — only in app views */}
          {currentView !== 'landing' && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#14141A] border border-white/[0.08] text-[11px] font-mono text-zinc-400 shrink-0 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF4D00]" />
              <span className="font-bold">AI ACTIVE</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
