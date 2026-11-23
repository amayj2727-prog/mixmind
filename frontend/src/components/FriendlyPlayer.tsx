import React from 'react';
import { PartyDeck } from './party/PartyDeck';
import { Track } from '../types';

interface FriendlyPlayerProps {
  currentTrack: Track | null;
  incomingTrack: Track | null;
  isPlaying: boolean;
  onPlayToggle: () => void;
  timeElapsed: number;
  duration: number;
  onSeek: (seconds: number) => void;
  nextBlendCountdown: number;
  blendIntervalSeconds: number;
  onBlendIntervalChange: (seconds: number) => void;
  onTriggerInstantMix: () => void;
  onSkipNextTrack: () => void;
  isTransitionExecuting: boolean;
  libraryTracks: Track[];
  onSelectNextTrack: (track: Track) => void;
  onAddTracks?: (tracks: Track[]) => void;
  currentEnergy: number;
  onEnergyChange: (energyVal: number) => void;
  onTriggerAirhorn: () => void;
  onTriggerSpinback: () => void;
  onTriggerSubDrop: () => void;
  onTriggerEchoFreeze: () => void;
  onSwitchToProMode?: () => void;
}

export const FriendlyPlayer: React.FC<FriendlyPlayerProps> = (props) => {
  return <PartyDeck {...props} />;
};
