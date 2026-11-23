import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause } from 'lucide-react';

export const AbTransitionWidget: React.FC = () => {
  const [abMode, setAbMode] = useState<'spotify' | 'mixmind'>('mixmind');
  const [activePreset, setActivePreset] = useState<'alan' | 'marshmello' | 'bollywood'>('bollywood');
  const [isPlayingDemo, setIsPlayingDemo] = useState<boolean>(false);
  const [demoProgress, setDemoProgress] = useState<number>(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  const playSynthesizedDemo = (mode: 'spotify' | 'mixmind', preset: 'alan' | 'marshmello' | 'bollywood') => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const bpm = preset === 'alan' ? 128 : preset === 'marshmello' ? 132 : 130;
    const beatInterval = 60 / bpm;
    const now = ctx.currentTime;

    for (let beat = 0; beat < 32; beat++) {
      const beatTime = now + beat * beatInterval;
      if (beatTime > now + 15) break;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (mode === 'spotify' && beat >= 12 && beat <= 20) {
        gain.gain.setValueAtTime(0.08, beatTime);
        osc.frequency.setValueAtTime(100, beatTime);
        osc.frequency.exponentialRampToValueAtTime(35, beatTime + 0.1);
      } else if (mode === 'mixmind' && beat >= 12 && beat < 16) {
        gain.gain.setValueAtTime(0.18, beatTime);
        osc.frequency.setValueAtTime(160 + beat * 15, beatTime);
        osc.frequency.exponentialRampToValueAtTime(45, beatTime + 0.12);
      } else if (mode === 'mixmind' && beat >= 16) {
        gain.gain.setValueAtTime(0.35, beatTime);
        osc.frequency.setValueAtTime(150, beatTime);
        osc.frequency.exponentialRampToValueAtTime(40, beatTime + 0.18);
      } else {
        gain.gain.setValueAtTime(0.22, beatTime);
        osc.frequency.setValueAtTime(140, beatTime);
        osc.frequency.exponentialRampToValueAtTime(42, beatTime + 0.12);
      }

      gain.gain.exponentialRampToValueAtTime(0.001, beatTime + 0.18);
      osc.start(beatTime);
      osc.stop(beatTime + 0.2);
    }
  };

  const handleToggleDemoPlay = async () => {
    if (isPlayingDemo) {
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
      setIsPlayingDemo(false);
      setDemoProgress(0);
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }

      setIsPlayingDemo(true);
      setDemoProgress(0);

      const startTime = Date.now();
      const totalDurationMs = 15000;

      playSynthesizedDemo(abMode, activePreset);

      demoIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(100, (elapsed / totalDurationMs) * 100);
        setDemoProgress(progress);

        if (elapsed >= totalDurationMs) {
          if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
          setIsPlayingDemo(false);
          setDemoProgress(0);
        }
      }, 50);
    } catch (e) {
      console.warn('Web Audio gesture required:', e);
      setIsPlayingDemo(false);
    }
  };

  const presets = [
    { id: 'bollywood' as const, label: 'Bollywood Club' },
    { id: 'alan' as const, label: 'Alan Walker' },
    { id: 'marshmello' as const, label: 'Marshmello' }
  ];

  return (
    <section className="py-16 w-full">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <span className="text-[11px] font-mono text-[#FF4D00] font-bold uppercase tracking-wider">
            Live A/B Test
          </span>
          <h3 className="font-headline font-extrabold text-xl sm:text-2xl text-white mt-1">
            Hear the difference yourself
          </h3>
        </div>

        {/* Style presets — flex-wrap so they never clip */}
        <div className="flex items-center flex-wrap gap-2">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setActivePreset(p.id);
                if (isPlayingDemo) handleToggleDemoPlay();
              }}
              className={`px-3 py-1 rounded-full text-xs font-body font-medium whitespace-nowrap transition-colors cursor-pointer ${
                activePreset === p.id
                  ? 'bg-[#FF4D00] text-white'
                  : 'bg-white/[0.04] text-zinc-400 hover:text-white border border-white/[0.08]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Comparison cards — equal height, generous padding */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
        {/* Standard Crossfade card */}
        <button
          onClick={() => {
            setAbMode('spotify');
            if (isPlayingDemo) handleToggleDemoPlay();
          }}
          className={`p-5 rounded-xl border text-left transition-colors h-full flex flex-col gap-2 cursor-pointer ${
            abMode === 'spotify'
              ? 'bg-[#14141A] border-white/20'
              : 'bg-[#14141A]/50 border-white/[0.06] hover:border-white/[0.12]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-zinc-400 font-bold uppercase">
              Standard Crossfade
            </span>
            {abMode === 'spotify' && (
              <span className="w-2 h-2 rounded-full bg-white shrink-0" />
            )}
          </div>
          <p className="text-sm text-zinc-400 font-body leading-relaxed flex-1">
            Volume dips, tempos clash, and the dancefloor stops moving.
          </p>
          <span className="text-[11px] font-mono text-white/20 pt-1">
            Default fade · No key sync
          </span>
        </button>

        {/* MIXMIND AI card */}
        <button
          onClick={() => {
            setAbMode('mixmind');
            if (isPlayingDemo) handleToggleDemoPlay();
          }}
          className={`p-5 rounded-xl border text-left transition-colors h-full flex flex-col gap-2 cursor-pointer ${
            abMode === 'mixmind'
              ? 'bg-[#14141A] border-[#FF4D00]'
              : 'bg-[#14141A]/50 border-white/[0.06] hover:border-white/[0.12]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-[#FF4D00] font-bold uppercase">
              MIXMIND AI Transition
            </span>
            {abMode === 'mixmind' && (
              <span className="w-2 h-2 rounded-full bg-[#FF4D00] shrink-0" />
            )}
          </div>
          <p className="text-sm text-zinc-300 font-body leading-relaxed flex-1">
            Downbeat sync, high-pass riser, and instantaneous sub-bass swap.
          </p>
          <span className="text-[11px] font-mono text-[#FF4D00]/40 pt-1">
            32-Beat Phrase · Exact Drop
          </span>
        </button>
      </div>

      {/* Transport / scrubber bar — flush with card edges */}
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-[#14141A] border border-white/[0.06] mt-4">
        <button
          onClick={handleToggleDemoPlay}
          className="w-9 h-9 rounded-full bg-[#FF4D00] hover:bg-[#E64500] text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
        >
          {isPlayingDemo ? <Pause className="w-4 h-4 fill-white" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs font-body mb-1.5">
            <span className="text-zinc-400 truncate">
              {isPlayingDemo
                ? `Playing: ${abMode === 'mixmind' ? 'MIXMIND AI' : 'Standard Crossfade'}`
                : 'Press play to hear the difference'}
            </span>
            <span className="text-zinc-400 font-mono tabular-nums text-[11px] shrink-0 ml-3">
              {isPlayingDemo ? `${Math.round((demoProgress / 100) * 15)}s` : '15s'}
            </span>
          </div>
          <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#FF4D00] transition-all duration-75 rounded-full"
              style={{ width: `${demoProgress}%` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
};
