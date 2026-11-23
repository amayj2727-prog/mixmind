import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2,
  FolderOpen,
  Waves,
  Sparkles,
  History,
  LayoutGrid,
  Layers,
  Zap
} from 'lucide-react';

import { TopNav } from './components/layout/TopNav';
import { StudioHeader } from './components/studio/StudioHeader';
import { HardwareMixer } from './components/studio/HardwareMixer';
import { TrackLibrary } from './components/studio/TrackLibrary';
import { PartyDeck } from './components/party/PartyDeck';
import { LandingPage } from './components/LandingPage';
import { DeckHardware } from './components/DeckHardware';
import { WaveformDisplay } from './components/WaveformDisplay';
import { PersonalityAndEnergy } from './components/PersonalityAndEnergy';
import { AiTransitionPanel } from './components/AiTransitionPanel';
import { LiveMashupPanel } from './components/LiveMashupPanel';
import { SessionHistory } from './components/SessionHistory';
import { QuickStartModal } from './components/QuickStartModal';
import { SoftSignupModal } from './components/SoftSignupModal';
import { SessionRecapModal } from './components/SessionRecapModal';
import { YouTubePlaylistModal } from './components/youtube/YouTubePlaylistModal';

import {
  Track,
  DeckState,
  DJMode,
  EnergyPhase,
  DJPersonality,
  TransitionPlan,
  MashupProposal,
  SessionHistoryItem,
  VirtualDJConnection,
  LockedPlaylist
} from './types';

import { audioEngine } from './audio/audioEngine';
import { useAutoMixEngine } from './hooks/useAutoMixEngine';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { loadFromStorage, saveToStorage } from './utils/storage';

import {
  INITIAL_TRACKS,
  DJ_PERSONALITIES,
  INITIAL_TRANSITION_PLAN,
  INITIAL_MASHUP_PROPOSALS,
  INITIAL_SESSION_HISTORY
} from './mockData';

export const App: React.FC = () => {
  // Routing & View State
  const getInitialRoute = (): 'landing' | 'app' => {
    if (typeof window === 'undefined') return 'landing';
    const p = window.location.pathname;
    if (p.includes('/app') || p.includes('/party') || p.includes('/studio')) return 'app';
    return 'landing';
  };

  const getInitialView = (): 'party' | 'studio' => {
    if (typeof window === 'undefined') return 'party';
    const p = window.location.pathname;
    if (p.includes('studio')) return 'studio';
    return loadFromStorage<'party' | 'studio'>('mixmind_current_view', 'party');
  };

  const [currentRoute, setCurrentRoute] = useState<'landing' | 'app'>(getInitialRoute);
  const [currentView, setCurrentView] = useState<'party' | 'studio'>(getInitialView);

  // Conversion Modals & Retention Flow
  const [showQuickStart, setShowQuickStart] = useState<boolean>(false);
  const [showSoftSignup, setShowSoftSignup] = useState<boolean>(false);
  const [showSessionRecap, setShowSessionRecap] = useState<boolean>(false);
  const [showYouTubeModal, setShowYouTubeModal] = useState<boolean>(false);
  const [lockedPlaylist, setLockedPlaylist] = useState<LockedPlaylist | null>(() =>
    loadFromStorage<LockedPlaylist | null>('mixmind_locked_playlist', null)
  );
  const [repeatPlaylist, setRepeatPlaylist] = useState<boolean>(true);
  const [, setTransitionsCompleted] = useState<number>(() =>
    loadFromStorage<number>('mixmind_transition_count', 0)
  );
  const [sessionPlaySeconds, setSessionPlaySeconds] = useState<number>(0);

  // Core DJ Settings with Safe Persistence
  const [djMode, setDjMode] = useState<DJMode>(() =>
    loadFromStorage<DJMode>('mixmind_dj_mode', 'autopilot')
  );
  const [manualTakeover, setManualTakeover] = useState<boolean>(false);
  const [blendIntervalSeconds, setBlendIntervalSeconds] = useState<number>(() =>
    loadFromStorage<number>('mixmind_blend_interval', 90)
  );
  const [hasStartedAudio, setHasStartedAudio] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);

  const [vdjConnection] = useState<VirtualDJConnection>({
    status: 'simulation',
    licenseTier: 'Home (Simulation)',
    oscPort: 8000,
    latencyMs: 3.8
  });

  // UI Studio Ergonomics
  const [activeTab, setActiveTab] = useState<'library' | 'blueprint' | 'mashup' | 'energy' | 'history'>('library');
  const [viewMode, setViewMode] = useState<'tabbed' | 'expanded'>('tabbed');

  // Personality & Energy Progression
  const [selectedPersonality, setSelectedPersonality] = useState<DJPersonality>(DJ_PERSONALITIES[0]);
  const [energyPhase, setEnergyPhase] = useState<EnergyPhase>('build');
  const [currentEnergy, setCurrentEnergy] = useState<number>(0.74);

  // Deck States
  const [libraryTracks, setLibraryTracks] = useState<Track[]>(() =>
    loadFromStorage<Track[]>('mixmind_library_tracks', INITIAL_TRACKS)
  );

  const [deck1, setDeck1] = useState<DeckState>({
    deck: 1,
    track: libraryTracks[0] || INITIAL_TRACKS[0],
    isPlaying: false,
    bpm: (libraryTracks[0] || INITIAL_TRACKS[0]).bpm,
    pitchPct: 0.0,
    key: (libraryTracks[0] || INITIAL_TRACKS[0]).key,
    beatPos: 0,
    phrasePos: 0,
    timeElapsed: 0.0,
    timeRemaining: (libraryTracks[0] || INITIAL_TRACKS[0]).duration,
    songpos: 0.0,
    eqLow: 1.0,
    eqMid: 1.0,
    eqHigh: 1.0,
    filter: 0.5,
    stems: { vocal: 1.0, instruments: 1.0, bass: 1.0, drums: 1.0 },
    loopActive: false,
    loopLengthBeats: 0
  });

  const [deck2, setDeck2] = useState<DeckState>({
    deck: 2,
    track: libraryTracks[1] || INITIAL_TRACKS[1],
    isPlaying: false,
    bpm: (libraryTracks[1] || INITIAL_TRACKS[1]).bpm,
    pitchPct: 0.0,
    key: (libraryTracks[1] || INITIAL_TRACKS[1]).key,
    beatPos: 0,
    phrasePos: 0,
    timeElapsed: 0.0,
    timeRemaining: (libraryTracks[1] || INITIAL_TRACKS[1]).duration,
    songpos: 0.0,
    eqLow: 0.0,
    eqMid: 1.0,
    eqHigh: 1.0,
    filter: 0.5,
    stems: { vocal: 1.0, instruments: 1.0, bass: 1.0, drums: 1.0 },
    loopActive: false,
    loopLengthBeats: 0
  });

  const [crossfader, setCrossfader] = useState<number>(0.0);
  const [transitionPlan, setTransitionPlan] = useState<TransitionPlan | null>(INITIAL_TRANSITION_PLAN);
  const [mashupProposals] = useState<MashupProposal[]>(INITIAL_MASHUP_PROPOSALS);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>(INITIAL_SESSION_HISTORY);

  // Auto Mix State Machine Engine Hook
  const {
    autoDjCountdown,
    autoDjPaused,
    setAutoDjPaused,
    isTransitionExecuting,
    activeMasterDeck,
    triggerManualTransition,
    queueNextTrackOnIdleDeck,
    setStemSafe,
    setEqSafe,
    setFilterSafe,
    setCrossfaderSafe
  } = useAutoMixEngine({
    deck1,
    deck2,
    setDeck1,
    setDeck2,
    crossfader,
    setCrossfader,
    djMode,
    manualTakeover,
    blendIntervalSeconds,
    libraryTracks,
    lockedPlaylist,
    repeatPlaylist,
    sessionHistory,
    setSessionHistory,
    transitionPlan,
    setTransitionPlan,
    onTransitionCompleted: () => {
      setTransitionsCompleted((prev) => {
        const next = prev + 1;
        saveToStorage('mixmind_transition_count', next);
        if (next === 3) {
          setShowSoftSignup(true);
        }
        return next;
      });
    }
  });

  // State Persistence Effects
  useEffect(() => {
    if (currentView === 'party') {
      setDjMode('autopilot');
      setAutoDjPaused(false);
      setManualTakeover(false);
    }
  }, [currentView, setAutoDjPaused]);

  useEffect(() => {
    saveToStorage('mixmind_dj_mode', djMode);
  }, [djMode]);

  useEffect(() => {
    saveToStorage('mixmind_blend_interval', blendIntervalSeconds);
  }, [blendIntervalSeconds]);

  useEffect(() => {
    saveToStorage('mixmind_library_tracks', libraryTracks);
  }, [libraryTracks]);

  useEffect(() => {
    saveToStorage('mixmind_current_view', currentView);
  }, [currentView]);

  useEffect(() => {
    saveToStorage('mixmind_locked_playlist', lockedPlaylist);
  }, [lockedPlaylist]);

  // Sync Live Web Audio Engine with Decks & Mixer Controls
  useEffect(() => {
    if (deck1.track?.audioUrl) audioEngine.loadDeckTrack(1, deck1.track.audioUrl);
  }, [deck1.track?.audioUrl]);

  useEffect(() => {
    if (deck2.track?.audioUrl) audioEngine.loadDeckTrack(2, deck2.track.audioUrl);
  }, [deck2.track?.audioUrl]);

  useEffect(() => {
    audioEngine.setDeckPitch(1, deck1.pitchPct);
  }, [deck1.pitchPct]);

  useEffect(() => {
    audioEngine.setDeckPitch(2, deck2.pitchPct);
  }, [deck2.pitchPct]);

  useEffect(() => {
    audioEngine.setDeckPlaying(1, deck1.isPlaying, deck1.bpm);
  }, [deck1.isPlaying, deck1.bpm]);

  useEffect(() => {
    audioEngine.setDeckPlaying(2, deck2.isPlaying, deck2.bpm);
  }, [deck2.isPlaying, deck2.bpm]);

  useEffect(() => {
    audioEngine.setCrossfader(crossfader);
  }, [crossfader]);

  useEffect(() => {
    audioEngine.setDeckStems(1, deck1.stems);
  }, [deck1.stems]);

  useEffect(() => {
    audioEngine.setDeckStems(2, deck2.stems);
  }, [deck2.stems]);

  useEffect(() => {
    audioEngine.setDeckEq(1, deck1.eqLow, deck1.eqMid, deck1.eqHigh);
  }, [deck1.eqLow, deck1.eqMid, deck1.eqHigh]);

  useEffect(() => {
    audioEngine.setDeckEq(2, deck2.eqLow, deck2.eqMid, deck2.eqHigh);
  }, [deck2.eqLow, deck2.eqMid, deck2.eqHigh]);

  useEffect(() => {
    audioEngine.setDeckFilter(1, deck1.filter);
  }, [deck1.filter]);

  useEffect(() => {
    audioEngine.setDeckFilter(2, deck2.filter);
  }, [deck2.filter]);

  useEffect(() => {
    audioEngine.setMasterMute(isAudioMuted);
  }, [isAudioMuted]);

  // Global user gesture unlock listener
  useEffect(() => {
    const unlockAudio = async () => {
      const ok = await audioEngine.unlockAllAudio();
      if (ok) setHasStartedAudio(true);
    };
    window.addEventListener('click', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    window.addEventListener('touchstart', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('click', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      window.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  // Time & Position Clock
  useEffect(() => {
    const timer = setInterval(() => {
      if (deck1.isPlaying || deck2.isPlaying) {
        setSessionPlaySeconds((s) => s + 0.1);
      }

      if (deck1.isPlaying) {
        setDeck1((d) => {
          const hw = audioEngine.getDeckTime(1);
          let newElapsed = d.timeElapsed + 0.1;
          if (hw.duration > 0) newElapsed = hw.currentTime;
          const dur = hw.duration > 0 ? hw.duration : d.track?.duration || 240;
          return {
            ...d,
            timeElapsed: newElapsed,
            timeRemaining: Math.max(0, dur - newElapsed),
            songpos: dur > 0 ? newElapsed / dur : 0
          };
        });
      }

      if (deck2.isPlaying) {
        setDeck2((d) => {
          const hw = audioEngine.getDeckTime(2);
          let newElapsed = d.timeElapsed + 0.1;
          if (hw.duration > 0) newElapsed = hw.currentTime;
          const dur = hw.duration > 0 ? hw.duration : d.track?.duration || 240;
          return {
            ...d,
            timeElapsed: newElapsed,
            timeRemaining: Math.max(0, dur - newElapsed),
            songpos: dur > 0 ? newElapsed / dur : 0
          };
        });
      }
    }, 100);
    return () => clearInterval(timer);
  }, [deck1.isPlaying, deck2.isPlaying]);

  // Route & View Handlers
  const handleLaunchParty = () => {
    setCurrentRoute('app');
    setCurrentView('party');
    window.history.pushState({}, '', '/app/party');
    setShowQuickStart(true);
  };

  const handleExploreStudio = () => {
    setCurrentRoute('app');
    setCurrentView('studio');
    window.history.pushState({}, '', '/app/studio');
  };

  const handleViewChange = (v: 'party' | 'studio') => {
    setCurrentView(v);
    window.history.pushState({}, '', `/app/${v}`);
  };

  const handlePlayToggle = async () => {
    await audioEngine.unlockAllAudio();
    setHasStartedAudio(true);

    const isCurrentPlaying = activeMasterDeck === 1 ? deck1.isPlaying : deck2.isPlaying;
    const isHwPaused = audioEngine.isDeckPaused(activeMasterDeck);

    // If UI state says playing but hardware was blocked/paused, start playback instead of pausing
    let next: boolean;
    if (isCurrentPlaying && isHwPaused) {
      next = true;
    } else {
      next = !isCurrentPlaying;
    }

    if (activeMasterDeck === 1) {
      setDeck1((d) => ({ ...d, isPlaying: next }));
      audioEngine.setDeckPlaying(1, next, deck1.bpm);
    } else {
      setDeck2((d) => ({ ...d, isPlaying: next }));
      audioEngine.setDeckPlaying(2, next, deck2.bpm);
    }
  };

  // Pro DJ Keyboard Shortcuts
  useKeyboardShortcuts({
    onTogglePlay: handlePlayToggle,
    onTriggerMix: triggerManualTransition,
    onAirhorn: () => audioEngine.triggerAirhorn(),
    onSubDrop: () => audioEngine.triggerSubDrop(),
    onSpinback: () => audioEngine.triggerSpinback(activeMasterDeck),
    onEchoFreeze: () => audioEngine.triggerEchoFreeze(activeMasterDeck),
    onToggleView: () => handleViewChange(currentView === 'party' ? 'studio' : 'party')
  });

  const handleGoHome = () => {
    setCurrentRoute('landing');
    window.history.pushState({}, '', '/');
  };

  const handleLoadTrack = (deckNum: 1 | 2, track: Track) => {
    const setter = deckNum === 1 ? setDeck1 : setDeck2;
    setter((d) => ({
      ...d,
      track,
      bpm: track.bpm,
      key: track.key,
      timeElapsed: 0,
      timeRemaining: track.duration,
      songpos: 0
    }));
    audioEngine.loadDeckTrack(deckNum, track.audioUrl);
  };

  const handleAddTracks = (newTracks: Track[]) => {
    setLibraryTracks((prev) => {
      const existingIds = new Set(prev.map((t) => t.id));
      const fresh = newTracks.filter((t) => !existingIds.has(t.id));
      return [...fresh, ...prev];
    });
  };

  const handleSelectPreMadeSet = (setName: string) => {
    let presetTracks = INITIAL_TRACKS;
    if (setName.toLowerCase().includes('bollywood')) {
      presetTracks = INITIAL_TRACKS.filter((t) => t.genre.toLowerCase().includes('bollywood'));
    }
    if (presetTracks.length === 0) presetTracks = INITIAL_TRACKS;
    setLibraryTracks(presetTracks);
    if (presetTracks[0]) handleLoadTrack(1, presetTracks[0]);
    if (presetTracks[1]) handleLoadTrack(2, presetTracks[1]);
    setShowQuickStart(false);
  };

  const handleQuickUploadTracks = (uploadedTracks: Track[]) => {
    handleAddTracks(uploadedTracks);
    if (uploadedTracks[0]) handleLoadTrack(1, uploadedTracks[0]);
    if (uploadedTracks[1]) handleLoadTrack(2, uploadedTracks[1]);
    setShowQuickStart(false);
  };

  // YouTube Playlist DJ Mode Handlers
  const handleLockPlaylist = (playlist: LockedPlaylist, autoPlay: boolean = true) => {
    setLockedPlaylist(playlist);
    setRepeatPlaylist(playlist.loopPlaylist);
    setDjMode('autopilot');
    setAutoDjPaused(false);
    setManualTakeover(false);
    const playable = playlist.tracks.filter((t) => !t.isUnavailable);
    setLibraryTracks(playable);

    // Reset crossfader to Deck 1 as master
    setCrossfaderSafe(0.0);

    if (playable[0]) handleLoadTrack(1, playable[0]);
    if (playable[1]) handleLoadTrack(2, playable[1]);

    if (autoPlay && playable[0]) {
      setHasStartedAudio(true);
      setDeck1((d) => ({ ...d, isPlaying: true }));
      audioEngine.setDeckPlaying(1, true, playable[0].bpm);
    }
  };

  const handleUnlockPlaylist = () => {
    setLockedPlaylist(null);
    setLibraryTracks(INITIAL_TRACKS);
    if (INITIAL_TRACKS[0]) handleLoadTrack(1, INITIAL_TRACKS[0]);
    if (INITIAL_TRACKS[1]) handleLoadTrack(2, INITIAL_TRACKS[1]);
  };

  // Render Landing Page
  if (currentRoute === 'landing') {
    return (
      <LandingPage
        onLaunchParty={handleLaunchParty}
        onExploreStudio={handleExploreStudio}
      />
    );
  }

  // Active Deck Track References
  const activeMasterTrack = activeMasterDeck === 1 ? deck1.track : deck2.track;
  const incomingTrack = activeMasterDeck === 1 ? deck2.track : deck1.track;

  return (
    <div className="min-h-screen bg-[#0D0D11] text-white flex flex-col font-sans selection:bg-[#FF4D00] selection:text-white">
      {/* 1. Global Modular Top Navigation Bar */}
      <TopNav
        currentView={currentView}
        onViewChange={handleViewChange}
        onGoHome={handleGoHome}
        mode={djMode}
        onModeChange={(m) => setDjMode(m)}
        vdjConnection={vdjConnection}
        manualTakeover={manualTakeover}
        onToggleTakeover={() => setManualTakeover((prev) => !prev)}
        isAudioMuted={isAudioMuted}
        onToggleAudio={() => setIsAudioMuted((prev) => !prev)}
        onOpenRecap={() => setShowSessionRecap(true)}
      />

      {/* Audio Unlock Helper Banner */}
      {!hasStartedAudio && (
        <div
          onClick={async () => {
            await audioEngine.unlockAllAudio();
            setHasStartedAudio(true);
            setIsAudioMuted(false);
          }}
          className="w-full bg-[#FF4D00] text-white font-headline text-xs font-black px-4 py-3 flex flex-wrap items-center justify-between gap-3 cursor-pointer shadow-xl hover:bg-[#FF5500] active:scale-[0.99] transition-all z-50 select-none border-b border-white/20"
        >
          <div className="flex items-center gap-2.5">
            <Volume2 className="w-5 h-5 fill-white" />
            <span className="tracking-wide">
              🔊 SOUND READY TO UNLOCK • CLICK ANYWHERE TO START YOUR AI DJ PARTY!
            </span>
          </div>
          <button className="px-4 py-1.5 rounded-xl bg-black text-[#FF4D00] font-headline font-extrabold text-xs border border-white/20 shadow-md">
            START MIX NOW ▶
          </button>
        </div>
      )}

      {/* Mode View: Party Deck vs Pro Studio */}
      {currentView === 'party' ? (
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <PartyDeck
            currentTrack={activeMasterTrack}
            incomingTrack={incomingTrack}
            isPlaying={activeMasterDeck === 1 ? deck1.isPlaying : deck2.isPlaying}
            onPlayToggle={handlePlayToggle}
            timeElapsed={activeMasterDeck === 1 ? deck1.timeElapsed : deck2.timeElapsed}
            duration={activeMasterDeck === 1 ? deck1.timeRemaining + deck1.timeElapsed : deck2.timeRemaining + deck2.timeElapsed}
            onSeek={(sec) => {
              const d = activeMasterDeck === 1 ? audioEngine.deck1 : audioEngine.deck2;
              d?.seek(sec);
              if (activeMasterDeck === 1) setDeck1((prev) => ({ ...prev, timeElapsed: sec }));
              else setDeck2((prev) => ({ ...prev, timeElapsed: sec }));
            }}
            nextBlendCountdown={autoDjCountdown}
            blendIntervalSeconds={blendIntervalSeconds}
            onBlendIntervalChange={(s) => setBlendIntervalSeconds(s)}
            onTriggerInstantMix={triggerManualTransition}
            onSkipNextTrack={() => queueNextTrackOnIdleDeck(activeMasterDeck === 1 ? 2 : 1, activeMasterDeck)}
            isTransitionExecuting={isTransitionExecuting}
            libraryTracks={libraryTracks}
            lockedPlaylist={lockedPlaylist}
            onUnlockPlaylist={handleUnlockPlaylist}
            onOpenYouTubeModal={() => setShowYouTubeModal(true)}
            onSelectNextTrack={(trk) => {
              const idleDeck = activeMasterDeck === 1 ? 2 : 1;
              handleLoadTrack(idleDeck, trk);
            }}
            onAddTracks={handleAddTracks}
            currentEnergy={currentEnergy}
            onEnergyChange={(eVal) => {
              setCurrentEnergy(eVal);
              const idleDeck = activeMasterDeck === 1 ? 2 : 1;
              queueNextTrackOnIdleDeck(idleDeck, activeMasterDeck);
            }}
            onTriggerAirhorn={() => audioEngine.triggerAirhorn()}
            onTriggerSpinback={() => audioEngine.triggerSpinback(activeMasterDeck)}
            onTriggerSubDrop={() => audioEngine.triggerSubDrop()}
            onTriggerEchoFreeze={() => audioEngine.triggerEchoFreeze(activeMasterDeck)}
          />
        </main>
      ) : (
        <>
          {/* Studio Compact Merged Telemetry Bar */}
          {djMode === 'autopilot' && !manualTakeover && (
            <StudioHeader
              activeMasterDeck={activeMasterDeck}
              masterTrack={activeMasterTrack}
              autoDjCountdown={autoDjCountdown}
              blendIntervalSeconds={blendIntervalSeconds}
              onBlendIntervalChange={(sec) => setBlendIntervalSeconds(sec)}
              isTransitionExecuting={isTransitionExecuting}
              onTriggerTransition={triggerManualTransition}
              onSkipTrack={() => queueNextTrackOnIdleDeck(activeMasterDeck === 1 ? 2 : 1, activeMasterDeck)}
              autoDjPaused={autoDjPaused}
              onTogglePause={() => setAutoDjPaused((prev) => !prev)}
              lockedPlaylist={lockedPlaylist}
              onUnlockPlaylist={handleUnlockPlaylist}
              onOpenYouTubeModal={() => setShowYouTubeModal(true)}
            />
          )}

          {/* Studio Workspace */}
          <main className="flex-1 p-3.5 space-y-3.5 max-w-[1720px] mx-auto w-full">
            {/* Waveform Canvas */}
            <WaveformDisplay
              deck1={deck1}
              deck2={deck2}
              transitionPlan={transitionPlan}
              onTriggerAirhorn={() => audioEngine.triggerAirhorn()}
              onTriggerSpinback={(d) => audioEngine.triggerSpinback(d)}
              onTriggerSubDrop={() => audioEngine.triggerSubDrop()}
              onTriggerEchoFreeze={(d) => audioEngine.triggerEchoFreeze(d)}
              onToggleHookLoop={(d) => {
                if (d === 1) setDeck1((prev) => ({ ...prev, loopActive: !prev.loopActive, loopLengthBeats: prev.loopActive ? 0 : 8 }));
                else setDeck2((prev) => ({ ...prev, loopActive: !prev.loopActive, loopLengthBeats: prev.loopActive ? 0 : 8 }));
              }}
            />

            {/* Hardware Mixer + Decks */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-3.5 items-stretch">
              <DeckHardware
                deck={deck1}
                colorTheme="teal"
                onPlayToggle={async () => {
                  await audioEngine.unlockAllAudio();
                  setHasStartedAudio(true);
                  const next = !deck1.isPlaying;
                  setDeck1((d) => ({ ...d, isPlaying: next }));
                  audioEngine.setDeckPlaying(1, next, deck1.bpm);
                }}
                onCue={() => {
                  setDeck1((d) => ({ ...d, timeElapsed: 0, isPlaying: false }));
                  audioEngine.deck1?.seek(0);
                  audioEngine.setDeckPlaying(1, false);
                }}
                onSync={() => setDeck1((d) => ({ ...d, bpm: deck2.bpm }))}
                onLoopToggle={(beats) => setDeck1((d) => ({ ...d, loopActive: beats > 0, loopLengthBeats: beats }))}
                onPitchChange={(p) => setDeck1((d) => ({ ...d, pitchPct: p, bpm: (d.track?.bpm || 124) * (1 + p / 100) }))}
                onStemChange={(s, val) => setStemSafe(1, s, val)}
              />

              <HardwareMixer
                deck1={deck1}
                deck2={deck2}
                crossfader={crossfader}
                onCrossfaderChange={setCrossfaderSafe}
                onEqChange={setEqSafe}
                onFilterChange={setFilterSafe}
              />

              <DeckHardware
                deck={deck2}
                colorTheme="purple"
                onPlayToggle={async () => {
                  await audioEngine.unlockAllAudio();
                  setHasStartedAudio(true);
                  const next = !deck2.isPlaying;
                  setDeck2((d) => ({ ...d, isPlaying: next }));
                  audioEngine.setDeckPlaying(2, next, deck2.bpm);
                }}
                onCue={() => {
                  setDeck2((d) => ({ ...d, timeElapsed: 0, isPlaying: false }));
                  audioEngine.deck2?.seek(0);
                  audioEngine.setDeckPlaying(2, false);
                }}
                onSync={() => setDeck2((d) => ({ ...d, bpm: deck1.bpm }))}
                onLoopToggle={(beats) => setDeck2((d) => ({ ...d, loopActive: beats > 0, loopLengthBeats: beats }))}
                onPitchChange={(p) => setDeck2((d) => ({ ...d, pitchPct: p, bpm: (d.track?.bpm || 124) * (1 + p / 100) }))}
                onStemChange={(s, val) => setStemSafe(2, s, val)}
              />
            </div>

            {/* Studio Navigation Bar */}
            <div className="bg-[#101018] border border-white/10 p-2 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs font-mono">
                {[
                  { id: 'library', label: 'MUSIC CRATE & LIBRARY', icon: FolderOpen, count: libraryTracks.length },
                  { id: 'blueprint', label: 'AI TRANSITION BLUEPRINT', icon: Waves, badge: 'TELEMETRY' },
                  { id: 'mashup', label: 'LIVE MASHUPS', icon: Sparkles, count: mashupProposals.length },
                  { id: 'energy', label: 'ENERGY & VIBE', icon: Zap },
                  { id: 'history', label: 'SET HISTORY', icon: History, count: sessionHistory.length }
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`px-3.5 py-2 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap shadow-sm cursor-pointer ${
                        isActive
                          ? 'bg-[#181824] text-white border border-[#FF4D00]/60'
                          : 'text-slate-400 hover:text-white hover:bg-white/[0.04] border border-transparent'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#FF4D00]' : 'text-slate-400'}`} />
                      <span>{tab.label}</span>
                      {tab.count !== undefined && (
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black tabular-nums ${
                          isActive ? 'bg-[#FF4D00] text-white' : 'bg-[#181824] text-slate-400'
                        }`}>
                          {tab.count}
                        </span>
                      )}
                      {tab.badge && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded font-black bg-amber-500 text-black">
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-1 bg-[#14141E] p-1 rounded-xl border border-white/10 text-[11px] font-mono">
                <button
                  onClick={() => setViewMode('tabbed')}
                  className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                    viewMode === 'tabbed' ? 'bg-[#FF4D00] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>FOCUSED</span>
                </button>
                <button
                  onClick={() => setViewMode('expanded')}
                  className={`px-2.5 py-1 rounded-lg flex items-center gap-1.5 font-bold transition-all cursor-pointer ${
                    viewMode === 'expanded' ? 'bg-[#FF4D00] text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>EXPAND ALL</span>
                </button>
              </div>
            </div>

            {/* Studio Active Workspace Content */}
            {viewMode === 'tabbed' ? (
              <div>
                {activeTab === 'library' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5 pb-6">
                    <div className="lg:col-span-2">
                      <TrackLibrary
                        tracks={libraryTracks}
                        onLoadTrack={handleLoadTrack}
                        onAddTracks={handleAddTracks}
                        lockedPlaylist={lockedPlaylist}
                        onUnlockPlaylist={handleUnlockPlaylist}
                        onOpenYouTubeModal={() => setShowYouTubeModal(true)}
                      />
                    </div>
                    <div>
                      <SessionHistory history={sessionHistory} />
                    </div>
                  </div>
                )}

                {activeTab === 'blueprint' && (
                  <div className="pb-6">
                    <AiTransitionPanel
                      plan={transitionPlan}
                      onExecuteTransition={triggerManualTransition}
                      onRejectTransition={() => queueNextTrackOnIdleDeck(activeMasterDeck === 1 ? 2 : 1, activeMasterDeck)}
                      isExecuting={isTransitionExecuting}
                      manualTakeover={manualTakeover}
                    />
                  </div>
                )}

                {activeTab === 'mashup' && (
                  <div className="pb-6">
                    <LiveMashupPanel
                      proposals={mashupProposals}
                      onLaunchMashup={() => {
                        audioEngine.triggerSubDrop();
                      }}
                      manualTakeover={manualTakeover}
                    />
                  </div>
                )}

                {activeTab === 'energy' && (
                  <div className="pb-6">
                    <PersonalityAndEnergy
                      personalities={DJ_PERSONALITIES}
                      selectedPersonality={selectedPersonality}
                      onSelectPersonality={(p) => setSelectedPersonality(p)}
                      energyPhase={energyPhase}
                      onSelectEnergyPhase={(phase) => {
                        setEnergyPhase(phase);
                        const energyMap = { build: 0.78, maintain: 0.74, peak: 0.95, drop: 0.88, reset: 0.55 };
                        setCurrentEnergy(energyMap[phase]);
                      }}
                      currentEnergyValue={currentEnergy}
                    />
                  </div>
                )}

                {activeTab === 'history' && (
                  <div className="pb-6">
                    <SessionHistory history={sessionHistory} />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3.5 pb-6">
                <PersonalityAndEnergy
                  personalities={DJ_PERSONALITIES}
                  selectedPersonality={selectedPersonality}
                  onSelectPersonality={(p) => setSelectedPersonality(p)}
                  energyPhase={energyPhase}
                  onSelectEnergyPhase={(phase) => {
                    setEnergyPhase(phase);
                    const energyMap = { build: 0.78, maintain: 0.74, peak: 0.95, drop: 0.88, reset: 0.55 };
                    setCurrentEnergy(energyMap[phase]);
                  }}
                  currentEnergyValue={currentEnergy}
                />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                  <AiTransitionPanel
                    plan={transitionPlan}
                    onExecuteTransition={triggerManualTransition}
                    onRejectTransition={() => queueNextTrackOnIdleDeck(activeMasterDeck === 1 ? 2 : 1, activeMasterDeck)}
                    isExecuting={isTransitionExecuting}
                    manualTakeover={manualTakeover}
                  />
                  <LiveMashupPanel
                    proposals={mashupProposals}
                    onLaunchMashup={() => audioEngine.triggerSubDrop()}
                    manualTakeover={manualTakeover}
                  />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3.5">
                  <div className="lg:col-span-2">
                    <TrackLibrary
                      tracks={libraryTracks}
                      onLoadTrack={handleLoadTrack}
                      onAddTracks={handleAddTracks}
                      lockedPlaylist={lockedPlaylist}
                      onUnlockPlaylist={handleUnlockPlaylist}
                      onOpenYouTubeModal={() => setShowYouTubeModal(true)}
                    />
                  </div>
                  <div>
                    <SessionHistory history={sessionHistory} />
                  </div>
                </div>
              </div>
            )}
          </main>
        </>
      )}

      {/* Modals */}
      <QuickStartModal
        isOpen={showQuickStart}
        onClose={() => setShowQuickStart(false)}
        onSelectSet={handleSelectPreMadeSet}
        onUploadTracks={handleQuickUploadTracks}
        onOpenYouTubeModal={() => setShowYouTubeModal(true)}
      />
      <YouTubePlaylistModal
        isOpen={showYouTubeModal}
        onClose={() => setShowYouTubeModal(false)}
        onLockPlaylist={handleLockPlaylist}
        currentLockedPlaylist={lockedPlaylist}
        onUnlockPlaylist={handleUnlockPlaylist}
      />
      <SoftSignupModal
        isOpen={showSoftSignup}
        onClose={() => setShowSoftSignup(false)}
        onContinue={() => {
          setShowSoftSignup(false);
          alert('Party Set Saved! Unlimited AI transitions unlocked.');
        }}
      />
      <SessionRecapModal
        isOpen={showSessionRecap}
        onClose={() => setShowSessionRecap(false)}
        sessionHistory={sessionHistory}
        totalPlayTimeSeconds={sessionPlaySeconds}
      />
    </div>
  );
};

export default App;
