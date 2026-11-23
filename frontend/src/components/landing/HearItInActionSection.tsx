import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

export const HearItInActionSection: React.FC = () => {
  const [selectedDemo, setSelectedDemo] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [mode, setMode] = useState<'mixmind' | 'spotify'>('mixmind');
  const [progress, setProgress] = useState<number>(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const DEMOS = [
    { id: 0, title: 'Tech House Drop', artist: 'Fisher vs. Mau P', key: '4A', bpm: '126 BPM', dur: '0:15' },
    { id: 1, title: 'Bollywood Club Blend', artist: 'Honey Singh vs. Sachin-Jigar', key: '9A', bpm: '130 BPM', dur: '0:15' },
    { id: 2, title: 'Desi Hip-Hop Bass Drop', artist: 'Karan Aujla vs. Ikky', key: '8A', bpm: '98 BPM', dur: '0:15' },
    { id: 3, title: 'Festival Mainstage Peak', artist: 'Anyma vs. Alok', key: '8A', bpm: '128 BPM', dur: '0:15' }
  ];

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    };
  }, []);

  const playSynthesizedTransition = (isAiMode: boolean) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    const bpm = 128;
    const beatInterval = 60 / bpm;
    const now = ctx.currentTime;

    for (let beat = 0; beat < 32; beat++) {
      const beatTime = now + beat * beatInterval;
      if (beatTime > now + 15) break;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (!isAiMode && beat >= 12 && beat <= 20) {
        gain.gain.setValueAtTime(0.08, beatTime);
        osc.frequency.setValueAtTime(100, beatTime);
        osc.frequency.exponentialRampToValueAtTime(35, beatTime + 0.1);
      } else if (isAiMode && beat >= 12 && beat < 16) {
        gain.gain.setValueAtTime(0.2, beatTime);
        osc.frequency.setValueAtTime(160 + beat * 15, beatTime);
        osc.frequency.exponentialRampToValueAtTime(45, beatTime + 0.12);
      } else if (isAiMode && beat >= 16) {
        gain.gain.setValueAtTime(0.38, beatTime);
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

  const handleTogglePlay = async () => {
    if (isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      setIsPlaying(false);
      setProgress(0);
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

      setIsPlaying(true);
      setProgress(0);

      const startTime = Date.now();
      const totalDuration = 15000;

      playSynthesizedTransition(mode === 'mixmind');

      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const p = Math.min(100, (elapsed / totalDuration) * 100);
        setProgress(p);

        if (elapsed >= totalDuration) {
          if (timerRef.current) clearInterval(timerRef.current);
          setIsPlaying(false);
          setProgress(0);
        }
      }, 50);
    } catch {
      setIsPlaying(false);
    }
  };

  return (
    <section className="py-16 w-full border-t border-white/[0.08]">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 text-left">
        <div>
          <span className="text-[10px] font-mono text-[#FF4D00] tracking-[0.2em] uppercase font-black block mb-1">
            LISTEN & EXPLORE
          </span>
          <h2 className="font-headline font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
            HEAR IT IN ACTION
          </h2>
        </div>

        {/* Instant Mode Pill */}
        <div className="inline-flex p-1 rounded-full bg-[#16161D] border border-white/10 text-xs font-mono self-start sm:self-auto">
          <button
            onClick={() => {
              setMode('spotify');
              if (isPlaying) handleTogglePlay();
            }}
            className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
              mode === 'spotify' ? 'bg-white/15 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Standard Fade
          </button>
          <button
            onClick={() => {
              setMode('mixmind');
              if (isPlaying) handleTogglePlay();
            }}
            className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
              mode === 'mixmind' ? 'bg-[#FF4D00] text-white shadow-md shadow-[#FF4D00]/30' : 'text-zinc-400 hover:text-white'
            }`}
          >
            MIXMIND Bass Swap
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Side: Waveform & Play Box */}
        <div className="lg:col-span-6 bg-[#14141A] border border-white/[0.08] rounded-3xl p-6 flex flex-col justify-between shadow-xl min-h-[220px]">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-400">{DEMOS[selectedDemo].title}</span>
            <span className="text-[#FF4D00] font-black">{DEMOS[selectedDemo].bpm} • {DEMOS[selectedDemo].key}</span>
          </div>

          <div className="flex items-center gap-4 my-4">
            <button
              onClick={handleTogglePlay}
              className="w-14 h-14 rounded-full bg-[#FF4D00] hover:bg-[#E64500] text-white flex items-center justify-center shadow-lg shadow-[#FF4D00]/30 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-white" /> : <Play className="w-6 h-6 fill-white ml-0.5" />}
            </button>
            <div className="text-left min-w-0">
              <p className="font-headline font-bold text-sm text-white truncate">
                {isPlaying ? 'Playing 15s Transition...' : 'Click to Audition Mix'}
              </p>
              <p className="text-xs font-mono text-zinc-400 truncate">
                {mode === 'mixmind' ? 'Beat-matched downbeat bass swap' : 'Default volume dip · No key sync'}
              </p>
            </div>
          </div>

          {/* Waveform Visualizer */}
          <div className="flex items-center gap-1 h-8">
            {Array.from({ length: 44 }).map((_, i) => {
              const h = isPlaying ? Math.sin(i * 0.4 + (progress / 100) * 12) * 12 + 16 : 6;
              const isPlayed = i / 44 <= progress / 100;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-full transition-all duration-75"
                  style={{
                    height: `${Math.max(4, h)}px`,
                    backgroundColor: isPlayed ? '#FF4D00' : '#2A2A36'
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Right Side: Track Selector Rows */}
        <div className="lg:col-span-6 flex flex-col justify-between gap-2">
          {DEMOS.map((demo, idx) => {
            const isSelected = selectedDemo === idx;
            return (
              <div
                key={demo.id}
                onClick={() => {
                  setSelectedDemo(idx);
                  if (isPlaying) handleTogglePlay();
                }}
                className={`p-3.5 rounded-2xl flex items-center justify-between cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-[#FF4D00] text-white border-[#FF4D00] shadow-md shadow-[#FF4D00]/25'
                    : 'bg-[#14141A] hover:bg-[#181822] text-zinc-300 border-white/[0.08]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    isSelected ? 'bg-black/25 text-white' : 'bg-white/[0.06] text-zinc-400'
                  }`}>
                    {isSelected && isPlaying ? <Volume2 className="w-3 h-3 animate-pulse" /> : <Play className="w-3 h-3 fill-current ml-0.5" />}
                  </div>
                  <div className="text-left min-w-0">
                    <p className="font-headline font-bold text-xs truncate text-white">{demo.title}</p>
                    <p className={`text-[10px] truncate ${isSelected ? 'text-white/80' : 'text-zinc-400'}`}>{demo.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono shrink-0 tabular-nums">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isSelected ? 'bg-black/20 text-white' : 'bg-white/[0.06] text-[#FF4D00]'
                  }`}>{demo.bpm}</span>
                  <span className={isSelected ? 'text-white/80' : 'text-zinc-500'}>{demo.dur}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
