export interface Track {
  id: number;
  title: string;
  artist: string;
  album: string;
  genre: string;
  bpm: number;
  key: string;          // Camelot e.g. "8A"
  duration: number;  // seconds
  energy: number;    // 0.0 - 1.0
  danceability: number;
  vocalPresence: number; // 0.0 - 1.0
  filepath: string;
  audioUrl?: string;
  hookStatement?: string;
  hookStartSec?: number;
  hookDurationSec?: number;
  dropTimeSec?: number;
  firstBeatSec?: number;
  introCueSec?: number;
  youtubeId?: string;
  youtubeUrl?: string;
  isUnavailable?: boolean;
}

export interface LockedPlaylist {
  id: string;
  title: string;
  channelTitle?: string;
  url: string;
  trackCount: number;
  tracks: Track[];
  loopPlaylist: boolean;
  lockedAt: string;
}

export type DJMode = 'autopilot' | 'copilot' | 'manual';

export type EnergyPhase = 'build' | 'maintain' | 'peak' | 'drop' | 'reset';

export interface DJPersonality {
  id: string;
  name: string;
  tagline: string;
  description: string;
  preferredGenres: string[];
  targetBpmRange: [number, number];
  preferredPhraseLength: number;
  color: string;
}

export interface StemsState {
  vocal: number;
  instruments: number;
  bass: number;
  drums: number;
}

export interface DeckState {
  deck: 1 | 2;
  track: Track | null;
  isPlaying: boolean;
  bpm: number;
  pitchPct: number;
  key: string;
  beatPos: number;
  phrasePos: number; // 0 to 31
  timeElapsed: number;
  timeRemaining: number;
  songpos: number; // 0.0 to 1.0
  eqLow: number;   // 0.0 to 1.0 (unity) to 2.0 (boost)
  eqMid: number;
  eqHigh: number;
  filter: number;  // 0.0 = LPF, 0.5 = Neutral, 1.0 = HPF
  stems: StemsState;
  loopActive: boolean;
  loopLengthBeats: number;
}

export interface TransitionPlan {
  planId: string;
  currentTrack: Track;
  incomingTrack: Track;
  style: 'smooth_blend' | 'extended_mix' | 'echo_out' | 'loop_based' | 'vocal_overlay' | 'buildup_drop';
  recommendedStartTimeSec: number;
  durationBeats: number;
  durationSeconds: number;
  targetBpm: number;
  pitchShiftPct: number;
  keyRelationship: string;
  confidenceScore: number;
  explanation: string;
  isValidated: boolean;
  status: 'pending' | 'executing' | 'completed' | 'rejected';
}

export interface MashupProposal {
  proposalId: string;
  title: string;
  baseTrack: Track;
  overlayTrack: Track;
  mashupType: string;
  baseDeck: 1 | 2;
  overlayDeck: 1 | 2;
  targetBpm: number;
  pitchShiftPct: number;
  harmonicRelation: string;
  baseStemLevels: StemsState;
  overlayStemLevels: StemsState;
  loopLengthBeats: number;
  confidenceScore: number;
  explanation: string;
  approved: boolean;
  isSimulation: boolean;
}

export interface SessionHistoryItem {
  id: string;
  track: Track;
  deck: 1 | 2;
  playedAt: string;
  transitionType: string;
  durationSec: number;
}

export interface VirtualDJConnection {
  status: 'connected' | 'simulation' | 'disconnected' | 'license_restricted';
  licenseTier: 'Home (Simulation)' | 'Pro Infinity' | 'Pro Subscription' | 'None';
  oscPort: number;
  latencyMs: number;
}
