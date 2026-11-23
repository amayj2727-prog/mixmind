import React from 'react';
import { Quote } from 'lucide-react';

export const CreatorStoriesSection: React.FC = () => {
  const testimonials = [
    {
      id: 1,
      quote: 'Dropped a 40-song YouTube playlist at our party. Flawless downbeat bass swaps all night.',
      author: 'Arjun M.',
      role: 'House Party Host'
    },
    {
      id: 2,
      quote: 'The Camelot harmonic key matching feels like an actual Pioneer DJ console in your browser.',
      author: 'Maya L.',
      role: 'Club Resident DJ'
    },
    {
      id: 3,
      quote: 'Zero aux anxiety. The sub-bass cuts eliminate all messy clashing between songs.',
      author: 'Karan S.',
      role: 'Event Curator'
    }
  ];

  return (
    <section className="py-16 w-full border-t border-white/[0.08]">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-8 text-left">
        <div>
          <span className="text-[10px] font-mono text-[#FF4D00] tracking-[0.2em] uppercase font-black block mb-1">
            COMMUNITY
          </span>
          <h2 className="font-headline font-extrabold text-2xl sm:text-3xl text-white tracking-tight">
            CREATOR STORIES
          </h2>
        </div>
        <p className="text-xs font-mono text-zinc-500">
          Used across 1,200+ live parties & sets
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {testimonials.map((t) => (
          <div
            key={t.id}
            className="bg-[#14141A] border border-white/[0.08] p-5 rounded-2xl flex flex-col justify-between text-left"
          >
            <p className="text-xs sm:text-sm text-zinc-300 font-body leading-relaxed mb-4">
              "{t.quote}"
            </p>

            <div className="border-t border-white/[0.06] pt-3 flex items-center justify-between text-xs">
              <span className="font-headline font-bold text-white">{t.author}</span>
              <span className="text-[11px] font-mono text-[#FF4D00]">{t.role}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
