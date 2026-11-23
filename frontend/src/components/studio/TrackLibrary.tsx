import React, { useState, useRef } from 'react';
import { FolderOpen, Plus, Search, CheckCircle2, Play, Mic, Flame, Lock } from 'lucide-react';
import { YoutubeIcon } from '../youtube/YoutubeIcon';
import { Track, LockedPlaylist } from '../../types';
import { processAudioFile } from '../../utils/audioFileHelper';

interface TrackLibraryProps {
  tracks: Track[];
  onLoadTrack: (deck: 1 | 2, track: Track) => void;
  onAddTracks?: (tracks: Track[]) => void;
  lockedPlaylist?: LockedPlaylist | null;
  onUnlockPlaylist?: () => void;
  onOpenYouTubeModal?: () => void;
}

export const TrackLibrary: React.FC<TrackLibraryProps> = ({
  tracks,
  onLoadTrack,
  onAddTracks,
  lockedPlaylist,
  onUnlockPlaylist,
  onOpenYouTubeModal
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string>('All');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilesSelected = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    const audioFiles = fileArray.filter(
      (f) => f.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(f.name)
    );
    if (audioFiles.length === 0) return;

    const processed = await Promise.all(audioFiles.map(processAudioFile));
    if (onAddTracks) {
      onAddTracks(processed);
      setUploadNotice(`Imported ${processed.length} track${processed.length > 1 ? 's' : ''} into crate!`);
      setTimeout(() => setUploadNotice(null), 4000);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      await handleFilesSelected(e.dataTransfer.files);
    }
  };

  const genres = ['All', ...Array.from(new Set(tracks.map((t) => t.genre).filter(Boolean)))];

  const filteredTracks = tracks.filter((t) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.genre.toLowerCase().includes(q) ||
      t.key.toLowerCase().includes(q);
    const matchesGenre = selectedGenre === 'All' || t.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  const formatDur = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`bg-[#14141E] border rounded-2xl p-4 shadow-xl select-none flex flex-col h-full font-body transition-colors relative ${
        isDragging ? 'border-[#FF4D00] bg-[#FF4D00]/5 ring-1 ring-[#FF4D00]' : 'border-white/10'
      }`}
    >
      {/* Hidden File Picker */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg"
        onChange={(e) => {
          if (e.target.files) handleFilesSelected(e.target.files);
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* Header & Search Toolbar — Strict Non-Colliding Gap-3 */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-[#FF4D00]" />
          <h3 className="text-xs font-headline font-extrabold tracking-wider text-white uppercase tabular-nums">
            {lockedPlaylist
              ? `LOCKED PLAYLIST: ${lockedPlaylist.title} (${filteredTracks.length} TRACKS)`
              : `LOCAL MUSIC LIBRARY & CRATE (${filteredTracks.length} TRACKS)`}
          </h3>
          {lockedPlaylist && (
            <span className="text-[9px] font-mono px-2 py-0.2 rounded-full bg-[#FF4D00]/20 text-[#FF4D00] font-black border border-[#FF4D00]/40">
              LOCKED
            </span>
          )}
        </div>

        {/* Toolbar: YouTube Playlist, + Add Music & Search Bar */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          {onOpenYouTubeModal && (
            <button
              onClick={onOpenYouTubeModal}
              className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-headline font-extrabold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                lockedPlaylist
                  ? 'bg-[#FF4D00] text-white shadow-md shadow-[#FF4D00]/25'
                  : 'bg-red-950/40 hover:bg-red-900/50 text-red-200 border border-red-500/40'
              }`}
              title="Open YouTube Playlist DJ Mode"
            >
              <YoutubeIcon className={`w-3.5 h-3.5 ${lockedPlaylist ? 'text-white' : 'text-red-500'}`} />
              <span>{lockedPlaylist ? 'Playlist Locked 🔒' : 'YouTube Playlist'}</span>
            </button>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            className="shrink-0 px-3.5 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white text-xs font-headline font-bold flex items-center gap-1.5 border border-white/10 transition-all cursor-pointer active:scale-95 whitespace-nowrap"
            title="Import local MP3 / WAV audio files"
          >
            <Plus className="w-3.5 h-3.5 text-[#FF4D00]" />
            <span>Add Music</span>
          </button>

          <div className="relative w-52 sm:w-64 shrink-0">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search title, artist, key..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#1A1A26] border border-[#2D2D40] focus:border-[#FF4D00] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none font-body transition-colors"
            />
          </div>
        </div>
      </div>

      {/* Locked Playlist Notification Banner */}
      {lockedPlaylist && (
        <div className="mt-2.5 px-3.5 py-2.5 rounded-xl bg-[#FF4D00]/15 border border-[#FF4D00]/40 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <Lock className="w-4 h-4 text-[#FF4D00] shrink-0" />
            <div className="min-w-0">
              <span className="font-headline font-bold text-white">
                Playlist Lock Active: {lockedPlaylist.title} ({lockedPlaylist.trackCount} tracks)
              </span>
              <span className="text-[11px] font-mono text-zinc-300 block">
                Auto-DJ and transition engine are locked strictly to this playlist pool.
              </span>
            </div>
          </div>
          {onUnlockPlaylist && (
            <button
              onClick={onUnlockPlaylist}
              className="px-2.5 py-1 rounded-lg bg-black/40 hover:bg-black text-white text-[11px] font-headline font-bold transition-colors cursor-pointer shrink-0 border border-white/10"
            >
              Clear Lock
            </button>
          )}
        </div>
      )}

      {/* Upload Notification */}
      {uploadNotice && (
        <div className="mt-2 px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-headline font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{uploadNotice}</span>
        </div>
      )}

      {/* Genre Filter Pills */}
      <div className="flex items-center gap-1.5 py-2.5 overflow-x-auto text-[11px] font-headline font-bold scrollbar-none">
        {genres.map((genre) => (
          <button
            key={genre}
            onClick={() => setSelectedGenre(genre)}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition-all cursor-pointer ${
              selectedGenre === genre
                ? 'bg-[#FF4D00] text-white'
                : 'bg-[#191926] text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            {genre}
          </button>
        ))}
      </div>

      {/* Track List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[380px] scrollbar-thin">
        {filteredTracks.map((track) => (
          <div
            key={track.id}
            className="flex items-center justify-between p-2 rounded-xl bg-[#181826] hover:bg-[#1E1E30] border border-white/5 hover:border-white/10 transition-colors group"
          >
            <div className="min-w-0 flex-1 pr-3">
              <div className="flex items-center gap-2">
                <p className="font-headline font-extrabold text-xs text-white truncate">
                  {track.title}
                </p>
                {track.youtubeId && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-red-600/20 border border-red-500/40 text-[9px] text-red-400 font-mono font-bold">
                    <YoutubeIcon className="w-2.5 h-2.5 text-red-500" /> YT
                  </span>
                )}
                {track.hookStatement && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-500/10 border border-amber-500/30 text-[9px] text-amber-300 font-mono">
                    <Mic className="w-2.5 h-2.5 text-amber-400" /> Hook Cue
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-medium truncate">{track.artist}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0 text-[10px] font-mono tabular-nums">
              <span className="px-2 py-0.5 rounded bg-black/40 border border-white/5 text-[#FF4D00] font-bold">
                {track.bpm} BPM
              </span>
              <span className="px-1.5 py-0.5 rounded bg-[#202030] text-slate-300">
                {track.key}
              </span>
              <span className="text-slate-500 hidden sm:inline">{formatDur(track.duration)}</span>

              {/* Load Buttons */}
              <div className="flex items-center gap-1 ml-1">
                <button
                  onClick={() => onLoadTrack(1, track)}
                  className="px-2 py-1 rounded-lg bg-[#FF4D00]/20 hover:bg-[#FF4D00] text-[#FF4D00] hover:text-white text-[10px] font-headline font-bold border border-[#FF4D00]/40 transition-colors cursor-pointer"
                  title="Load into Deck 1"
                >
                  DECK 1
                </button>
                <button
                  onClick={() => onLoadTrack(2, track)}
                  className="px-2 py-1 rounded-lg bg-[#FFA066]/20 hover:bg-[#FFA066] text-[#FFA066] hover:text-black text-[10px] font-headline font-bold border border-[#FFA066]/40 transition-colors cursor-pointer"
                  title="Load into Deck 2"
                >
                  DECK 2
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
