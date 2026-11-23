import React from 'react';
import { HardwareMixer } from './studio/HardwareMixer';
import { DeckState } from '../types';

interface CentralMixerProps {
  deck1: DeckState;
  deck2: DeckState;
  crossfader: number;
  onCrossfaderChange: (val: number) => void;
  onEqChange: (deck: 1 | 2, band: 'low' | 'mid' | 'high', val: number) => void;
  onFilterChange: (deck: 1 | 2, val: number) => void;
}

export const CentralMixer: React.FC<CentralMixerProps> = (props) => {
  return <HardwareMixer {...props} />;
};
