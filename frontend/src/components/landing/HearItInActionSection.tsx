import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, ArrowRight, Sparkles } from 'lucide-react';

interface HearItInActionSectionProps {
  onLaunchParty?: () => void;
}

export const HearItInActionSection: React.FC<HearItInActionSectionProps> = ({ onLaunchParty }) => {
  const [selectedDemo, setSelectedDemo] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [mode, setMode] = useState<'mixmind' | 'spotify'>('mixmind');
  const [progress, setProgress] = useState<number>(0);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('0:00');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const DEMOS = [
    {
      id: 0,
      title: 'Party All Night (Extended)',
      artist: 'Yo Yo Honey Singh',
      key: '8B',
      bpm: '130 BPM',
      src: '/songs/party_all_night.mp3',
      startTime: 30, // start at high-energy chorus
      dur: '0:15'
    },
    {
      id: 1,
      title: 'Bollywood Club Blend',
      artist: 'Honey Singh & Jaz Dhami',
      key: '9A',
      bpm: '130 BPM',
      src: '/songs/high_heels.mp3',
      startTime: 20,
      dur: '0:15'
    },
    {
      id: 2,
      title: 'Desi Hip-Hop Bass Drop',
      artist: 'Yo Yo Honey Singh',
      key: '8A',
      bpm: '128 BPM',
      src: '/songs/blue_eyes.mp3',
      startTime: 15,
      dur: '0:15'
    },
    {
      id: 3,
      title: 'High-Energy Party Anthem',
      artist: 'Yo Yo Honey Singh',
      key: '8B',
      bpm: '128 BPM',
      src: '/songs/dope_shope.mp3',
      startTime: 15,
      dur: '0:15'
    }
  ];

  const currentDemo = DEMOS[selectedDemo] || DEMOS[0];

  const stopCurrentAudio = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setProgress(0);
    setCurrentTimeStr('0:00');
  };

  useEffect(() => {
    return () => {
      stopCurrentAudio();
    };
  }, []);

  const playDemoTrack = async (demoIndex: number, currentMode: 'mixmind' | 'spotify' = mode) => {
    const targetDemo = DEMOS[demoIndex];
    if (!targetDemo) return;

    // Clean up any ongoing timer/playback
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioRef.current) {
      audioRef.current.pause();
    }

    try {
      const audio = new Audio(targetDemo.src);
      audioRef.current = audio;
      audio.volume = currentMode === 'mixmind' ? 1.0 : 0.65;
      audio.currentTime = targetDemo.startTime;

      await audio.play();
      setIsPlaying(true);
      setSelectedDemo(demoIndex);

      const clipStart = Date.now();
      const clipDuration = 15000; // 15s preview

      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - clipStart;
        const p = Math.min(100, (elapsed / clipDuration) * 100);
        setProgress(p);

        const secs = Math.floor(elapsed / 1000);
        setCurrentTimeStr(`0:${secs < 10 ? '0' : ''}${secs}`);

        // Simulate Spotify volume dip in 'spotify' mode during middle 5 seconds
        if (currentMode === 'spotify' && audioRef.current) {
          if (elapsed > 4000 && elapsed < 10000) {
            audioRef.current.volume = 0.35; // standard dip
          } else {
            audioRef.current.volume = 0.65;
          }
        }

        if (elapsed >= clipDuration) {
          stopCurrentAudio();
        }
      }, 50);
    } catch {
      // Fallback if browser blocks unmuted audio
      setIsPlaying(false);
    }
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      stopCurrentAudio();
    } else {
      playDemoTrack(selectedDemo, mode);
    }
  };

  const handleSelectTrack = (idx: number) => {
    setSelectedDemo(idx);
    playDemoTrack(idx, mode);
  };

  const handleModeChange = (newMode: 'mixmind' | 'spotify') => {
    setMode(newMode);
    if (isPlaying) {
      playDemoTrack(selectedDemo, newMode);
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
            onClick={() => handleModeChange('spotify')}
            className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
              mode === 'spotify' ? 'bg-white/15 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Standard Fade
          </button>
          <button
            onClick={() => handleModeChange('mixmind')}
            className={`px-3 py-1 rounded-full font-bold transition-all cursor-pointer ${
              mode === 'mixmind' ? 'bg-[#FF4D00] text-white shadow-md shadow-[#FF4D00]/30' : 'text-zinc-400 hover:text-white'
            }`}
          >
            MIXMIND Bass Swap
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Side: Real Audio Player & Waveform Box */}
        <div className="lg:col-span-6 bg-[#14141A] border border-white/[0.08] rounded-3xl p-6 flex flex-col justify-between shadow-xl min-h-[240px]">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-white font-bold">{currentDemo.title}</span>
            <span className="text-[#FF4D00] font-black">{currentDemo.bpm} • {currentDemo.key}</span>
          </div>

          <div className="flex items-center gap-4 my-4">
            <button
              onClick={handleTogglePlay}
              className="w-14 h-14 rounded-full bg-[#FF4D00] hover:bg-[#E64500] text-white flex items-center justify-center shadow-lg shadow-[#FF4D00]/40 active:scale-95 transition-all cursor-pointer shrink-0"
              title={isPlaying ? 'Pause' : 'Play Audition'}
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-white" />
              ) : (
                <Play className="w-6 h-6 fill-white ml-0.5" />
              )}
            </button>
            <div className="text-left min-w-0 flex-1">
              <p className="font-headline font-bold text-sm text-white truncate">
                {isPlaying ? `Playing 15s Mix Preview (${currentTimeStr} / 0:15)...` : 'Click to Audition Live Audio'}
              </p>
              <p className="text-xs font-mono text-zinc-400 truncate mt-0.5">
                {mode === 'mixmind'
                  ? '⚡ MIXMIND DSP: Beat-matched downbeat bass swap (Punchy)'
                  : '⚠️ Standard Fade: Default volume dip · No downbeat sync'}
              </p>
            </div>
          </div>

          {/* Animated Waveform Visualizer */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1 h-8">
              {Array.from({ length: 44 }).map((_, i) => {
                const h = isPlaying
                  ? Math.sin(i * 0.45 + (progress / 100) * 14) * 12 + 16
                  : 6;
                const isPlayed = i / 44 <= progress / 100;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-full transition-all duration-75"
                    style={{
                      height: `${Math.max(4, h)}px`,
                      backgroundColor: isPlayed ? '#FF4D00' : '#2A2A36',
                      boxShadow: isPlayed && isPlaying ? '0 0 4px rgba(255,77,0,0.5)' : 'none'
                    }}
                  />
                );
              })}
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500">
              <span className="text-[#FF4D00] font-bold">{currentTimeStr}</span>
              <span>0:15 PREVIEW</span>
            </div>
          </div>

          {/* Direct CTA */}
          {onLaunchParty && (
            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between mt-2">
              <span className="text-xs text-zinc-400 font-mono">Want the full continuous mix?</span>
              <button
                onClick={() => {
                  stopCurrentAudio();
                  onLaunchParty();
                }}
                className="text-xs font-headline font-black text-[#FF4D00] hover:text-[#FF6622] flex items-center gap-1 cursor-pointer"
              >
                <span>Open in Party Mode</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Track Selector Rows */}
        <div className="lg:col-span-6 flex flex-col justify-between gap-2">
          {DEMOS.map((demo, idx) => {
            const isSelected = selectedDemo === idx;
            return (
              <div
                key={demo.id}
                onClick={() => handleSelectTrack(idx)}
                className={`p-3.5 rounded-2xl flex items-center justify-between cursor-pointer transition-all border select-none active:scale-[0.99] ${
                  isSelected
                    ? 'bg-[#FF4D00] text-white border-[#FF4D00] shadow-md shadow-[#FF4D00]/25'
                    : 'bg-[#14141A] hover:bg-[#181822] text-zinc-300 border-white/[0.08]'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0 pr-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-black/25 text-white' : 'bg-white/[0.06] text-zinc-400'
                    }`}
                  >
                    {isSelected && isPlaying ? (
                      <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    )}
                  </div>
                  <div className="text-left min-w-0">
                    <p className="font-headline font-bold text-xs truncate text-white">{demo.title}</p>
                    <p className={`text-[11px] truncate ${isSelected ? 'text-white/80' : 'text-zinc-400'}`}>
                      {demo.artist}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono shrink-0 tabular-nums">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isSelected ? 'bg-black/20 text-white' : 'bg-white/[0.06] text-[#FF4D00]'
                    }`}
                  >
                    {demo.bpm}
                  </span>
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
