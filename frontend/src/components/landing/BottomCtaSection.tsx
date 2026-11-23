import React from 'react';
import { ArrowRight } from 'lucide-react';

interface BottomCtaSectionProps {
  onLaunchParty: () => void;
}

export const BottomCtaSection: React.FC<BottomCtaSectionProps> = ({ onLaunchParty }) => {
  return (
    <section className="py-12 w-full">
      <div className="py-10 px-6 md:px-10 rounded-2xl text-center flex flex-col items-center gap-4 bg-[#14141A] border border-white/[0.08]">
        <h3 className="font-headline font-extrabold text-2xl sm:text-3xl text-white">
          Ready to start mixing?
        </h3>
        <p className="font-body text-zinc-400 max-w-md mx-auto text-sm leading-relaxed">
          Your first session takes under 30 seconds. No account needed.
        </p>
        <button
          onClick={onLaunchParty}
          className="h-11 px-6 rounded-full bg-[#FF4D00] hover:bg-[#E64500] text-white font-headline font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer mt-1"
        >
          <span>Start Mixing Free</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </section>
  );
};
