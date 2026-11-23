import React from 'react';
import { Sparkles, ShieldCheck, Check, X, ArrowRight } from 'lucide-react';

interface SoftSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: () => void;
}

export const SoftSignupModal: React.FC<SoftSignupModalProps> = ({
  isOpen,
  onClose,
  onContinue
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md glass-surface border border-[#FF4D00]/40 rounded-3xl p-6 sm:p-8 shadow-2xl relative text-white text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Floating Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF4D00]/20 text-[#FF4D00] text-xs font-mono font-black mb-4">
          <Sparkles className="w-3.5 h-3.5 fill-[#FF4D00]" />
          <span>3 TRANSITIONS COMPLETED FREE!</span>
        </div>

        <h3 className="font-headline font-extrabold text-2xl text-white mb-2">
          Save Your Party Mix
        </h3>
        <p className="text-xs text-slate-300 font-body mb-6 leading-relaxed">
          Unlock unlimited continuous AI transitions, custom set recording, and export full house-party tracklists.
        </p>

        {/* Feature bullets */}
        <div className="space-y-2 text-left mb-6 bg-white/[0.03] p-3.5 rounded-2xl border border-white/[0.06] text-xs font-mono text-slate-300">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#FF4D00] shrink-0" />
            <span>Unlimited AI beat-matched transitions</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#FF4D00] shrink-0" />
            <span>Save & export party tracklists</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#FF4D00] shrink-0" />
            <span>Access Pro DJ Studio & 4-Stem Isolation</span>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={onContinue}
            className="w-full py-3.5 px-6 rounded-full bg-[#FF4D00] hover:bg-[#FF6622] text-white font-headline font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FF4D00]/30 active:scale-95 transition-all cursor-pointer"
          >
            <span>Continue with Google</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onContinue}
            className="w-full py-3 px-6 rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-white font-headline font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <span>Continue with Email</span>
          </button>

          <button
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white pt-2 transition-colors cursor-pointer"
          >
            Maybe Later (Keep Current Mix Playing)
          </button>
        </div>
      </div>
    </div>
  );
};
