import React from 'react';
import { ArrowRight, Play, Activity, Disc3, Lock, Sparkles, Volume2 } from 'lucide-react';
import { TopNav } from './layout/TopNav';
import { HardwareConsoleMockup } from './landing/HardwareConsoleMockup';
import { ExploreModulesSection } from './landing/ExploreModulesSection';
import { HearItInActionSection } from './landing/HearItInActionSection';
import { SignalFlowSection } from './landing/SignalFlowSection';
import { CreatorStoriesSection } from './landing/CreatorStoriesSection';
import { BottomCtaSection } from './landing/BottomCtaSection';

interface LandingPageProps {
  onLaunchParty: () => void;
  onExploreStudio: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchParty,
  onExploreStudio
}) => {
  return (
    <div className="w-full min-h-screen bg-[#0D0D11] text-white flex flex-col items-center selection:bg-[#FF4D00] selection:text-white">
      {/* 1. Global Navigation Bar */}
      <TopNav
        currentView="landing"
        onViewChange={(v) => {
          if (v === 'party') onLaunchParty();
          else onExploreStudio();
        }}
        onGoHome={() => {}}
        mode="autopilot"
        onModeChange={() => {}}
        vdjConnection={{
          status: 'simulation',
          licenseTier: 'Home (Simulation)',
          oscPort: 8000,
          latencyMs: 3.8
        }}
        manualTakeover={false}
        onToggleTakeover={() => {}}
      />

      {/* 2. Main Content — Spacious Max-W-6xl Container */}
      <main className="w-full max-w-6xl mx-auto px-5 sm:px-8 flex flex-col items-center">

        {/* HERO SECTION: Modular Audio & Autonomous Mixing Without Limits */}
        <section className="pt-16 sm:pt-24 pb-16 w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            
            {/* Left Hero Column: Typography & CTAs */}
            <div className="lg:col-span-6 space-y-6 text-left">
              {/* Eyebrow Pill */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-mono">
                <span className="w-2 h-2 rounded-full bg-[#FF4D00] animate-pulse" />
                <span className="text-zinc-300 tracking-wider uppercase font-bold text-[11px]">
                  AI DJ PERFORMANCE SYSTEM
                </span>
                <span className="text-white/20">•</span>
                <span className="text-[#FF4D00] font-black text-[10px]">ZERO CONSOLE REQUIRED</span>
              </div>

              {/* Massive Punchy Headline */}
              <h1 className="font-headline font-extrabold text-4xl sm:text-5xl lg:text-[3.75rem] tracking-tight leading-[1.06] text-white">
                MODULAR MIXING
                <br />
                <span className="text-[#FF4D00]">WITHOUT CONSOLES.</span>
              </h1>

              {/* Subheadline — Tight & Punchy */}
              <p className="font-body text-base sm:text-lg text-zinc-400 max-w-md leading-relaxed">
                Pro DJ transitions, harmonic downbeat bass swaps, and zero awkward pauses. Drop any YouTube playlist and feel the mix.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={onLaunchParty}
                  className="h-12 px-6 rounded-full bg-[#FF4D00] hover:bg-[#E64500] text-white font-headline font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-[#FF4D00]/25 cursor-pointer active:scale-98"
                >
                  <span>Launch Party Mode</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  onClick={onExploreStudio}
                  className="h-12 px-6 rounded-full bg-transparent hover:bg-white/[0.06] border border-white/[0.15] text-white font-headline font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-white ml-0.5" />
                  <span>Explore Pro Studio</span>
                </button>
              </div>

              {/* 3-Item Trust & Capability Row */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/[0.08] max-w-lg">
                <div className="flex items-center gap-2 text-zinc-400">
                  <Activity className="w-4 h-4 text-[#FF4D00] shrink-0" />
                  <span className="text-xs font-mono font-medium">Real-Time DSP</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <Disc3 className="w-4 h-4 text-[#FF4D00] shrink-0" />
                  <span className="text-xs font-mono font-medium">32-Beat Sync</span>
                </div>
                <div className="flex items-center gap-2 text-zinc-400">
                  <Lock className="w-4 h-4 text-[#FF4D00] shrink-0" />
                  <span className="text-xs font-mono font-medium">YouTube Lock</span>
                </div>
              </div>
            </div>

            {/* Right Hero Column: Tactile Hardware Console Mockup */}
            <div className="lg:col-span-6 w-full">
              <HardwareConsoleMockup />
            </div>
          </div>
        </section>

        {/* SECTION 2: EXPLORE OUR MODULES (Hardware Architecture) */}
        <div id="modules" className="w-full">
          <ExploreModulesSection onLaunchParty={onLaunchParty} />
        </div>

        {/* SECTION 3: HEAR IT IN ACTION (Interactive A/B Audio Player) */}
        <div id="demos" className="w-full">
          <HearItInActionSection onLaunchParty={onLaunchParty} />
        </div>

        {/* SECTION 4: THE SIGNAL FLOW (Interactive Schematic Diagram) */}
        <div id="signal-flow" className="w-full">
          <SignalFlowSection onLaunchParty={onLaunchParty} />
        </div>

        {/* SECTION 5: CREATOR STORIES (Authentic Host & DJ Feedback) */}
        <div id="stories" className="w-full">
          <CreatorStoriesSection />
        </div>

        {/* SECTION 6: READY TO TURN YOUR LIVING ROOM INTO A CLUB? (Bottom CTA) */}
        <BottomCtaSection onLaunchParty={onLaunchParty} />
      </main>

      {/* 3. Global Modern Footer */}
      <footer className="w-full border-t border-white/[0.08] bg-[#0A0A0E] px-6 py-10 text-center text-xs font-body text-zinc-400 mt-auto">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-headline font-black text-white text-sm tracking-wider">
              MIXMIND
            </span>
            <span className="text-zinc-600">|</span>
            <span className="font-mono text-[11px] text-zinc-400">
              The AI DJ in Your Pocket
            </span>
          </div>

          <p className="text-[11px] font-mono text-zinc-400">
            © 2026 MIXMIND. All rights reserved. Zero ₹2 Lakh console required.
          </p>

          <div className="flex items-center gap-4 text-xs font-mono text-zinc-400">
            <button onClick={onLaunchParty} className="hover:text-white transition-colors cursor-pointer">
              Party Mode
            </button>
            <button onClick={onExploreStudio} className="hover:text-white transition-colors cursor-pointer">
              Pro Studio
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
