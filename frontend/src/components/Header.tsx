import React from 'react';
import { TopNav } from './layout/TopNav';
import { DJMode, VirtualDJConnection } from '../types';

interface HeaderProps {
  mode: DJMode;
  onModeChange: (mode: DJMode) => void;
  vdjConnection: VirtualDJConnection;
  manualTakeover: boolean;
  onToggleTakeover: () => void;
  isAudioMuted?: boolean;
  onToggleAudio?: () => void;
  currentView: 'party' | 'studio';
  onViewChange: (view: 'party' | 'studio') => void;
  onGoHome?: () => void;
  onOpenRecap?: () => void;
}

export const Header: React.FC<HeaderProps> = (props) => {
  return <TopNav {...props} />;
};
