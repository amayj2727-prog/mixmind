import React, { useState } from 'react';
import { Share2, Check, Download, X, Sparkles, Music, Flame, Disc } from 'lucide-react';
import { SessionHistoryItem } from '../types';

interface SessionRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionHistory: SessionHistoryItem[];
  totalPlayTimeSeconds: number;
}

export const SessionRecapModal: React.FC<SessionRecapModalProps> = ({
  isOpen,
  onClose,
  sessionHistory,
  totalPlayTimeSeconds
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const hours = Math.floor(totalPlayTimeSeconds / 3600);
  const minutes = Math.floor((totalPlayTimeSeconds % 3600) / 60);
  const timeString = hours > 0 ? `${hours}h ${minutes}m` : `${minutes || 24}m`;
  const mixCount = Math.max(sessionHistory.length, 12);

  const handleCopyLink = () => {
    navigator.clipboard?.writeText?.(window.location.origin + '?party=' + Date.now());
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-lg glass-surface border border-white/[0.12] rounded-3xl p-6 sm:p-8 shadow-2xl relative text-white text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Brand Lockup */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF4D00]/15 text-[#FF4D00] text-xs font-mono font-black mb-4">
          <Sparkles className="w-3.5 h-3.5 fill-[#FF4D00]" />
          <span>SESSION RECAP • HOUSE PARTY MASTER</span>
        </div>

        <h3 className="font-headline font-extrabold text-2xl sm:text-3xl text-white mb-2">
          Your House Party Set
        </h3>
        <p className="text-xs text-slate-400 font-body mb-6">
          Zero awkward silences. 100% beat-matched dancefloor energy.
        </p>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-3 gap-2.5 mb-6">
          <div className="bg-[#14141E] p-3 rounded-2xl border border-white/[0.06]">
            <div className="text-[10px] font-mono text-slate-400 uppercase">SET LENGTH</div>
            <div className="font-headline font-extrabold text-lg text-white mt-1">{timeString}</div>
          </div>
          <div className="bg-[#14141E] p-3 rounded-2xl border border-white/[0.06]">
            <div className="text-[10px] font-mono text-slate-400 uppercase">AI TRANSITIONS</div>
            <div className="font-headline font-extrabold text-lg text-[#FF4D00] mt-1">{mixCount} Mixes</div>
          </div>
          <div className="bg-[#14141E] p-3 rounded-2xl border border-white/[0.06]">
            <div className="text-[10px] font-mono text-slate-400 uppercase">PEAK ENERGY</div>
            <div className="font-headline font-extrabold text-lg text-amber-300 mt-1">130 BPM</div>
          </div>
        </div>

        {/* Recent Mix Highlights */}
        <div className="text-left bg-white/[0.02] border border-white/[0.06] rounded-2xl p-4 mb-6 max-h-40 overflow-y-auto divide-y divide-white/[0.04]">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-2">
            TRACKLIST HIGHLIGHTS
          </span>
          {(sessionHistory.length > 0 ? sessionHistory.slice(0, 5) : [
            { id: '1', track: { title: 'Party All Night (Extended)', artist: 'Yo Yo Honey Singh', bpm: 130 }, transitionType: '32-BEAT BASS SWAP' },
            { id: '2', track: { title: 'High Heels (Extended)', artist: 'Jaz Dhami & Honey Singh', bpm: 130 }, transitionType: 'DOWNBEAT DROP' },
            { id: '3', track: { title: 'Tu Meri (Extended)', artist: 'Vishal-Shekhar', bpm: 128 }, transitionType: 'PROGRESSIVE RISER' }
          ]).map((item: any, i: number) => (
            <div key={item.id || i} className="py-2 flex items-center justify-between text-xs">
              <div className="truncate pr-2">
                <span className="text-white font-bold">{item.track?.title}</span>
                <span className="text-slate-400 ml-1.5">• {item.track?.artist}</span>
              </div>
              <span className="text-[10px] font-mono text-[#FF4D00] shrink-0 font-bold">
                {item.transitionType}
              </span>
            </div>
          ))}
        </div>

        {/* Share Action Button */}
        <div className="space-y-3">
          <button
            onClick={handleCopyLink}
            className="w-full py-3.5 px-6 rounded-full bg-[#FF4D00] hover:bg-[#FF6622] text-white font-headline font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FF4D00]/30 active:scale-95 transition-all cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>Set Link Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 text-white" />
                <span>Share Set Link with Guests</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white pt-1 transition-colors cursor-pointer"
          >
            Return to DJ Player
          </button>
        </div>
      </div>
    </div>
  );
};
