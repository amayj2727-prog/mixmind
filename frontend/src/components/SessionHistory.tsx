import React from 'react';
import { History, Disc } from 'lucide-react';
import { SessionHistoryItem } from '../types';

interface SessionHistoryProps {
  history: SessionHistoryItem[];
}

export const SessionHistory: React.FC<SessionHistoryProps> = ({ history }) => {
  return (
    <div className="bg-[#14141E] border border-white/10 rounded-2xl p-4 shadow-xl select-none flex flex-col h-full font-body">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-[#FF4D00]" />
          <h3 className="text-xs font-mono font-bold tracking-wider text-white uppercase tabular-nums">
            LIVE SESSION HISTORY ({history.length} TRACKS)
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-500">REALTIME LOG</span>
      </div>

      {/* History List with Tabular Numbers */}
      <div className="overflow-y-auto flex-1 max-h-72 divide-y divide-white/5 pt-1 pr-1 scrollbar-thin">
        {history.map((item, idx) => (
          <div key={item.id} className="py-2 px-1 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5 min-w-0 pr-2">
              <span className="font-mono text-[10px] text-slate-500 w-5 tabular-nums">#{idx + 1}</span>
              <div className="w-6 h-6 rounded bg-[#1A1A28] border border-white/10 flex items-center justify-center shrink-0">
                <Disc className="w-3.5 h-3.5 text-[#FF4D00]" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white truncate">{item.track.title}</p>
                <p className="text-[10px] text-slate-400 truncate">{item.track.artist}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0 text-[10px] font-mono tabular-nums">
              <span
                className={`px-1.5 py-0.5 rounded font-bold ${
                  item.deck === 1
                    ? 'bg-[#FF4D00]/20 text-[#FF4D00] border border-[#FF4D00]/40'
                    : 'bg-purple-950 text-purple-400 border border-purple-800'
                }`}
              >
                D{item.deck}
              </span>
              <span className="text-slate-400">{item.playedAt}</span>
              <span className="text-slate-500 hidden sm:inline">{item.transitionType}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
