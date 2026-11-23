import React, { useRef, useState } from 'react';
import { Sparkles, UploadCloud, Music, ArrowRight, X, Flame, Disc, Check } from 'lucide-react';
import { YoutubeIcon } from './youtube/YoutubeIcon';
import { Track } from '../types';
import { processAudioFile } from '../utils/audioFileHelper';

interface QuickStartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSet: (setName: string) => void;
  onUploadTracks: (tracks: Track[]) => void;
  onOpenYouTubeModal?: () => void;
}

export const QuickStartModal: React.FC<QuickStartModalProps> = ({
  isOpen,
  onClose,
  onSelectSet,
  onUploadTracks,
  onOpenYouTubeModal
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!isOpen) return null;

  const PRE_MADE_SETS = [
    { id: 'bollywood', name: 'Bollywood Club', bpm: '130 BPM', count: '10 Tracks', icon: '💃', vibe: 'High Energy Bollytech' },
    { id: 'house', name: 'House Party Bangerz', bpm: '128 BPM', count: '12 Tracks', icon: '⚡', vibe: 'Peak-Time Big Room' },
    { id: 'desi', name: 'Desi Hip-Hop', bpm: '100 BPM', count: '8 Tracks', icon: '🔥', vibe: 'Punchy Urban Drops' },
    { id: 'chill', name: 'Late Night Chill', bpm: '105 BPM', count: '10 Tracks', icon: '🍸', vibe: 'Deep Warm Melodies' }
  ];

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const audioFiles = Array.from(files).filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(f.name));
    if (audioFiles.length === 0) return;

    const processed = await Promise.all(audioFiles.map(processAudioFile));
    onUploadTracks(processed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-xl glass-surface border border-white/[0.12] rounded-3xl p-6 sm:p-8 shadow-2xl relative text-white">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-[#FF4D00]/20 text-[#FF4D00] font-black uppercase tracking-wider">
            ZERO FRICTION ONBOARDING
          </span>
          <h3 className="font-headline font-extrabold text-2xl text-white mt-1.5">
            How do you want to start?
          </h3>
          <p className="text-xs text-slate-400 font-body mt-1">
            Hear your first AI beat-matched transition in under 30 seconds.
          </p>
        </div>

        {/* 2 Instant Entry Options */}
        <div className="space-y-4">
          {/* Option 1: Pre-Made Set */}
          <div className="bg-[#12121A] border border-white/[0.08] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-headline font-bold text-slate-300 flex items-center gap-1.5">
                <span>🎛️</span> Option 1: Start with a Pre-Made Party Set
              </span>
              <span className="text-[10px] font-mono text-[#FF4D00] font-black">1-CLICK PLAY</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {PRE_MADE_SETS.map((set) => (
                <button
                  key={set.id}
                  onClick={() => onSelectSet(set.id)}
                  className="p-3 rounded-xl bg-white/[0.03] hover:bg-[#FF4D00]/15 border border-white/[0.06] hover:border-[#FF4D00]/60 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xl">{set.icon}</span>
                    <span className="text-[10px] font-mono text-[#FF4D00] font-bold">{set.bpm}</span>
                  </div>
                  <div className="font-headline font-bold text-xs text-white group-hover:text-[#FF4D00] transition-colors mt-1.5 truncate">
                    {set.name}
                  </div>
                  <div className="text-[10px] text-slate-400 font-body truncate">
                    {set.vibe}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Option 2: Upload Own Tracks */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            className={`border-2 border-dashed rounded-2xl p-5 cursor-pointer text-center transition-all ${
              isDragging 
                ? 'border-[#FF4D00] bg-[#FF4D00]/10 scale-[1.01]' 
                : 'border-white/10 hover:border-[#FF4D00]/50 bg-[#12121A]'
            }`}
          >
            <input 
              ref={fileInputRef} 
              type="file" 
              multiple 
              accept="audio/*,.mp3,.wav,.m4a,.aac,.flac" 
              onChange={(e) => handleFiles(e.target.files)} 
              className="hidden" 
            />
            <div className="w-10 h-10 rounded-full bg-[#FF4D00]/20 text-[#FF4D00] flex items-center justify-center mx-auto mb-2 font-black">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div className="font-headline font-bold text-sm text-white">
              Option 2: Upload / Drop Your Own MP3s
            </div>
            <p className="text-xs text-slate-400 font-body mt-0.5">
              Drag & drop audio files from your Mac or click to browse
            </p>
          </div>

          {/* Option 3: YouTube Playlist DJ Mode */}
          {onOpenYouTubeModal && (
            <div
              onClick={() => {
                onClose();
                onOpenYouTubeModal();
              }}
              className="p-4 rounded-2xl bg-red-950/20 hover:bg-red-950/30 border border-red-500/30 hover:border-red-500/60 cursor-pointer flex items-center justify-between gap-3 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center shrink-0">
                  <YoutubeIcon className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-headline font-bold text-sm text-white group-hover:text-red-400 transition-colors">
                      Option 3: YouTube Playlist DJ Mode
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.2 rounded bg-red-500/20 text-red-300 font-bold uppercase">
                      LOCKED POOL
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 font-body mt-0.5">
                    Paste any YouTube playlist URL to strictly lock the DJ set to those songs.
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors shrink-0" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
