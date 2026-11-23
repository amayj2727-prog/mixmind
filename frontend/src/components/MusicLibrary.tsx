import React from 'react';
import { TrackLibrary } from './studio/TrackLibrary';
import { Track } from '../types';

interface MusicLibraryProps {
  tracks: Track[];
  onLoadTrack: (deck: 1 | 2, track: Track) => void;
  onAddTracks?: (tracks: Track[]) => void;
}

export const MusicLibrary: React.FC<MusicLibraryProps> = (props) => {
  return <TrackLibrary {...props} />;
};
