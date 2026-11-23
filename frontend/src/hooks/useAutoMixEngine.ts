import { useState, useEffect, useRef, useCallback } from 'react';
import { Track, DeckState, DJMode, TransitionPlan, SessionHistoryItem, LockedPlaylist } from '../types';
import { audioEngine } from '../audio/audioEngine';

export type AutoMixState = 'IDLE' | 'PLAYING' | 'BLEND_PRIMED' | 'TRANSITIONING' | 'PAUSED';

interface UseAutoMixEngineProps {
  deck1: DeckState;
  deck2: DeckState;
  setDeck1: React.Dispatch<React.SetStateAction<DeckState>>;
  setDeck2: React.Dispatch<React.SetStateAction<DeckState>>;
  crossfader: number;
  setCrossfader: (val: number) => void;
  djMode: DJMode;
  manualTakeover: boolean;
  blendIntervalSeconds: number;
  libraryTracks: Track[];
  lockedPlaylist?: LockedPlaylist | null;
  repeatPlaylist?: boolean;
  sessionHistory: SessionHistoryItem[];
  setSessionHistory: React.Dispatch<React.SetStateAction<SessionHistoryItem[]>>;
  transitionPlan: TransitionPlan | null;
  setTransitionPlan: React.Dispatch<React.SetStateAction<TransitionPlan | null>>;
  onTransitionCompleted?: () => void;
}

export function useAutoMixEngine({
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
  lockedPlaylist = null,
  repeatPlaylist = true,
  sessionHistory,
  setSessionHistory,
  transitionPlan,
  setTransitionPlan,
  onTransitionCompleted
}: UseAutoMixEngineProps) {
  // Deterministic state machine state
  const [engineState, setEngineState] = useState<AutoMixState>('IDLE');
  const [activeMasterDeck, setActiveMasterDeck] = useState<1 | 2>(1);
  const [autoDjCountdown, setAutoDjCountdown] = useState<number>(blendIntervalSeconds);
  const [autoDjPaused, setAutoDjPaused] = useState<boolean>(false);

  // Transition locking & timer references
  const isTransitioningRef = useRef<boolean>(false);
  const transitionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ref tracking current states to avoid stale closures in timers
  const stateRef = useRef({
    deck1,
    deck2,
    activeMasterDeck,
    crossfader,
    blendIntervalSeconds,
    djMode,
    manualTakeover,
    autoDjPaused,
    libraryTracks,
    lockedPlaylist,
    repeatPlaylist,
    sessionHistory,
    transitionPlan
  });

  useEffect(() => {
    stateRef.current = {
      deck1,
      deck2,
      activeMasterDeck,
      crossfader,
      blendIntervalSeconds,
      djMode,
      manualTakeover,
      autoDjPaused,
      libraryTracks,
      lockedPlaylist,
      repeatPlaylist,
      sessionHistory,
      transitionPlan
    };
  }, [
    deck1,
    deck2,
    activeMasterDeck,
    crossfader,
    blendIntervalSeconds,
    djMode,
    manualTakeover,
    autoDjPaused,
    libraryTracks,
    lockedPlaylist,
    repeatPlaylist,
    sessionHistory,
    transitionPlan
  ]);

  // Safe clamping utilities
  const clamp01 = (val: number): number => {
    if (isNaN(val)) return 0.5;
    return Math.max(0.0, Math.min(1.0, val));
  };

  const clampEq = (val: number): number => {
    if (isNaN(val)) return 1.0;
    return Math.max(0.0, Math.min(2.0, val));
  };

  // Safe stem adjustment helper with smooth ramping
  const setStemSafe = useCallback(
    (deck: 1 | 2, stem: 'vocal' | 'instruments' | 'bass' | 'drums', val: number) => {
      const safeVal = clamp01(val);
      const updater = deck === 1 ? setDeck1 : setDeck2;
      updater((d) => {
        const nextStems = { ...d.stems, [stem]: safeVal };
        audioEngine.setDeckStems(deck, nextStems);
        return { ...d, stems: nextStems };
      });
    },
    [setDeck1, setDeck2]
  );

  // Safe EQ adjustment helper
  const setEqSafe = useCallback(
    (deck: 1 | 2, band: 'low' | 'mid' | 'high', val: number) => {
      const safeVal = clampEq(val);
      const prop = band === 'low' ? 'eqLow' : band === 'mid' ? 'eqMid' : 'eqHigh';
      const updater = deck === 1 ? setDeck1 : setDeck2;
      updater((d) => {
        const next = { ...d, [prop]: safeVal };
        audioEngine.setDeckEq(deck, next.eqLow, next.eqMid, next.eqHigh);
        return next;
      });
    },
    [setDeck1, setDeck2]
  );

  // Safe filter adjustment helper
  const setFilterSafe = useCallback(
    (deck: 1 | 2, val: number) => {
      const safeVal = clamp01(val);
      const updater = deck === 1 ? setDeck1 : setDeck2;
      updater((d) => {
        audioEngine.setDeckFilter(deck, safeVal);
        return { ...d, filter: safeVal };
      });
    },
    [setDeck1, setDeck2]
  );

  // Safe crossfader adjustment
  const setCrossfaderSafe = useCallback(
    (val: number) => {
      const safeVal = clamp01(val);
      setCrossfader(safeVal);
      audioEngine.setCrossfader(safeVal);
    },
    [setCrossfader]
  );

  // Whenever lockedPlaylist changes, ensure activeMasterDeck is 1 and auto-DJ is unpaused
  useEffect(() => {
    if (lockedPlaylist) {
      setActiveMasterDeck(1);
      setAutoDjCountdown(blendIntervalSeconds);
      setAutoDjPaused(false);
      isTransitioningRef.current = false;
      setCrossfaderSafe(0.0);
    }
  }, [lockedPlaylist, blendIntervalSeconds, setCrossfaderSafe]);

  // Camelot wheel harmonic score
  const calculateHarmonicScore = (key1: string, key2: string): number => {
    const parse = (k: string) => {
      const num = parseInt(k.replace(/[^\d]/g, ''), 10) || 1;
      const letter = k.toUpperCase().includes('B') ? 'B' : 'A';
      return { num, letter };
    };
    const c1 = parse(key1);
    const c2 = parse(key2);
    if (c1.num === c2.num && c1.letter === c2.letter) return 1.0;
    if (c1.letter === c2.letter && (Math.abs(c1.num - c2.num) === 1 || Math.abs(c1.num - c2.num) === 11)) return 0.92;
    if (c1.num === c2.num && c1.letter !== c2.letter) return 0.85;
    return 0.4;
  };

  // Queue next track on the newly idle deck
  const queueNextTrackOnIdleDeck = useCallback(
    (idleDeck: 1 | 2, currentMasterDeck: 1 | 2) => {
      const currentMasterTrack = currentMasterDeck === 1 ? stateRef.current.deck1.track : stateRef.current.deck2.track;
      if (!currentMasterTrack) return;

      // ── STRICT TRACKLIST LOCKING ───────────────────────────────────────────────────────
      // When a YouTube Playlist is locked, candidates are drawn EXCLUSIVELY from that playlist.
      // Unavailable/deleted videos are filtered out.
      // No external tracks, global library tracks, or fallback recommendations are EVER pulled!
      const isLocked = !!stateRef.current.lockedPlaylist;
      const effectivePool = isLocked
        ? stateRef.current.lockedPlaylist!.tracks.filter((t) => !t.isUnavailable)
        : stateRef.current.libraryTracks;

      // Check if all playlist tracks have been played when repeat is disabled
      if (isLocked && stateRef.current.repeatPlaylist === false) {
        const playedIds = new Set(stateRef.current.sessionHistory.map((h) => h.track.id));
        playedIds.add(currentMasterTrack.id);
        const hasUnplayed = effectivePool.some((t) => !playedIds.has(t.id));
        if (!hasUnplayed) {
          console.info('[Locked Playlist DJ Mode] All tracks in playlist have been played and repeat is off. Clean stop.');
          return;
        }
      }

      // 1. Unplayed tracks priority: guarantees EVERY song in the playlist is played before looping
      const allPlayedIds = new Set(stateRef.current.sessionHistory.map((h) => h.track.id));
      allPlayedIds.add(currentMasterTrack.id);

      const unplayedPool = effectivePool.filter((t) => !allPlayedIds.has(t.id));

      let candidatePool: Track[];
      if (unplayedPool.length > 0) {
        candidatePool = unplayedPool;
      } else {
        if (isLocked && stateRef.current.repeatPlaylist === false) {
          console.info('[Locked Playlist DJ Mode] All tracks in playlist played and repeat is off. Clean stop.');
          return;
        }
        // Loop back: exclude the 3 most recently played tracks to prevent immediate repeats
        const recentlyPlayedIds = stateRef.current.sessionHistory.slice(0, 3).map((h) => h.track.id);
        candidatePool = effectivePool.filter(
          (t) => t.id !== currentMasterTrack.id && !recentlyPlayedIds.includes(t.id)
        );
        if (candidatePool.length === 0) {
          candidatePool = effectivePool.filter((t) => t.id !== currentMasterTrack.id);
        }
      }
      if (candidatePool.length === 0) return;

      const scored = candidatePool.map((cand) => {
        const harmScore = calculateHarmonicScore(currentMasterTrack.key, cand.key);
        const bpmDiff = Math.abs(cand.bpm - currentMasterTrack.bpm);
        const bpmPenalty = bpmDiff > 8 ? 0.35 : 1.0;
        const bpmScore = Math.max(0, 1 - bpmDiff / 15) * bpmPenalty;
        return { track: cand, score: harmScore * 0.6 + bpmScore * 0.4, harmScore };
      });

      scored.sort((a, b) => b.score - a.score);
      const nextTrack = scored[0].track;

      // Professional pitch calculation with half-time/double-time check & +/- 8% clamp
      let effectiveIncomingBpm = nextTrack.bpm;
      if (Math.abs(currentMasterTrack.bpm - nextTrack.bpm * 2) <= 8) {
        effectiveIncomingBpm = nextTrack.bpm * 2;
      } else if (Math.abs(currentMasterTrack.bpm - nextTrack.bpm / 2) <= 6) {
        effectiveIncomingBpm = nextTrack.bpm / 2;
      }
      const rawPitchPct = ((currentMasterTrack.bpm - effectiveIncomingBpm) / effectiveIncomingBpm) * 100;
      const pitchShiftPct = Math.max(-8.0, Math.min(8.0, rawPitchPct));
      const isExtremeBpm = Math.abs(rawPitchPct) > 8.0;

      const setter = idleDeck === 1 ? setDeck1 : setDeck2;
      setter((d) => ({
        ...d,
        track: nextTrack,
        bpm: nextTrack.bpm,
        key: nextTrack.key,
        timeElapsed: 0,
        timeRemaining: nextTrack.duration,
        songpos: 0,
        eqLow: 0.0,
        eqMid: 1.0,
        eqHigh: 1.0,
        filter: 0.5
      }));

      setTransitionPlan({
        planId: `plan_${Date.now()}`,
        currentTrack: currentMasterTrack,
        incomingTrack: nextTrack,
        recommendedStartTimeSec: 32.0,
        targetBpm: currentMasterTrack.bpm,
        pitchShiftPct,
        durationBeats: 32,
        durationSeconds: Math.round((32 * 60) / currentMasterTrack.bpm),
        style: isExtremeBpm ? 'buildup_drop' : 'smooth_blend',
        keyRelationship: scored[0].harmScore > 0.85 ? 'Harmonic Match' : 'Energy Boost',
        confidenceScore: 0.95,
        explanation: isExtremeBpm
          ? `Downbeat drop transition from ${currentMasterTrack.title} into ${nextTrack.title}.`
          : `Scheduled downbeat bass swap from ${currentMasterTrack.title} to ${nextTrack.title}.`,
        isValidated: true,
        status: 'pending'
      });
    },
    [setDeck1, setDeck2, setTransitionPlan]
  );

  // Transition execution logic
  const executeTransition = useCallback(
    (fromDeck: 1 | 2, toDeck: 1 | 2) => {
      if (isTransitioningRef.current) return;
      isTransitioningRef.current = true;
      setEngineState('TRANSITIONING');

      // Clear any pending transition timer
      if (transitionTimerRef.current) {
        clearInterval(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }

      try {
        audioEngine.ensureRunning();

        const masterBpm = fromDeck === 1 ? stateRef.current.deck1.bpm : stateRef.current.deck2.bpm;
        const incomingTrack = toDeck === 1 ? stateRef.current.deck1.track : stateRef.current.deck2.track;
        const incomingCue = incomingTrack?.introCueSec || incomingTrack?.firstBeatSec || 0.07;
        const nativeBpm = incomingTrack?.bpm || masterBpm;
        let effectiveBpm = nativeBpm;
        if (Math.abs(masterBpm - nativeBpm * 2) <= 8) effectiveBpm = nativeBpm * 2;
        else if (Math.abs(masterBpm - nativeBpm / 2) <= 6) effectiveBpm = nativeBpm / 2;

        const rawPitch = ((masterBpm - effectiveBpm) / effectiveBpm) * 100;
        const pitchPct = Math.max(-8.0, Math.min(8.0, rawPitch));

        // Start incoming deck with quantized downbeat launch & bass cut
        audioEngine.quantizedStart(fromDeck, toDeck, masterBpm, incomingCue);

        const incomingSetter = toDeck === 1 ? setDeck1 : setDeck2;
        incomingSetter((d) => ({
          ...d,
          isPlaying: true,
          eqLow: 0.0,
          eqMid: 0.85,
          eqHigh: 1.0,
          filter: 0.5,
          bpm: masterBpm,
          pitchPct,
          stems: { vocal: 0.0, instruments: 1.0, bass: 0.0, drums: 1.0 }
        }));

        let step = 0;
        const totalSteps = 120; // 12 seconds across 100ms ticks
        const initialCf = stateRef.current.crossfader;
        const targetCf = toDeck === 1 ? 0.0 : 1.0;

        transitionTimerRef.current = setInterval(() => {
          try {
            step++;
            const progress = step / totalSteps;

            // Maintain phase synchronization safely
            audioEngine.lockPhase(fromDeck, toDeck, masterBpm, incomingCue);

            // Constant-power S-curve crossfade
            const sProgress = 0.5 * (1 - Math.cos(progress * Math.PI));
            const currentCf = initialCf + (targetCf - initialCf) * sProgress;
            setCrossfaderSafe(currentCf);

            // Highpass riser on outgoing track
            if (progress >= 0.28 && progress < 0.5) {
              const riserProgress = (progress - 0.28) / 0.22;
              const sweepVal = 0.5 + riserProgress * 0.36;
              const outSetter = fromDeck === 1 ? setDeck1 : setDeck2;
              outSetter((d) => ({ ...d, filter: sweepVal }));
            }

            // Downbeat Bass Swap at 50% midpoint
            if (progress >= 0.5) {
              if (toDeck === 1) {
                setDeck1((d) => ({
                  ...d,
                  eqLow: 1.0,
                  filter: 0.5,
                  stems: { vocal: 1.0, instruments: 1.0, bass: 1.0, drums: 1.0 }
                }));
                setDeck2((d) => ({
                  ...d,
                  eqLow: 0.0,
                  filter: 0.86,
                  stems: { vocal: 0.0, instruments: 0.3, bass: 0.0, drums: 0.3 }
                }));
              } else {
                setDeck2((d) => ({
                  ...d,
                  eqLow: 1.0,
                  filter: 0.5,
                  stems: { vocal: 1.0, instruments: 1.0, bass: 1.0, drums: 1.0 }
                }));
                setDeck1((d) => ({
                  ...d,
                  eqLow: 0.0,
                  filter: 0.86,
                  stems: { vocal: 0.0, instruments: 0.3, bass: 0.0, drums: 0.3 }
                }));
              }
            }

            // Transition Completion
            if (step >= totalSteps) {
              if (transitionTimerRef.current) {
                clearInterval(transitionTimerRef.current);
                transitionTimerRef.current = null;
              }

              isTransitioningRef.current = false;
              setCrossfaderSafe(targetCf);

              // Stop outgoing hardware playback
              audioEngine.setDeckPlaying(fromDeck, false);

              const fromSetter = fromDeck === 1 ? setDeck1 : setDeck2;
              fromSetter((d) => ({
                ...d,
                isPlaying: false,
                filter: 0.5,
                eqLow: 1.0,
                stems: { vocal: 1.0, instruments: 1.0, bass: 1.0, drums: 1.0 }
              }));

              setActiveMasterDeck(toDeck);
              setEngineState('PLAYING');
              setAutoDjCountdown(stateRef.current.blendIntervalSeconds);

              // Record session history
              const playedTrack = toDeck === 1 ? stateRef.current.deck1.track : stateRef.current.deck2.track;
              if (playedTrack) {
                const newHistoryItem: SessionHistoryItem = {
                  id: `hist_${Date.now()}`,
                  track: playedTrack,
                  deck: toDeck,
                  playedAt: new Date().toLocaleTimeString(),
                  transitionType: '32-BEAT BEAT-MATCHED BLEND',
                  durationSec: 12
                };
                setSessionHistory((h) => [newHistoryItem, ...h]);
              }

              if (onTransitionCompleted) {
                onTransitionCompleted();
              }

              // Queue next track on the now-idle deck
              queueNextTrackOnIdleDeck(fromDeck, toDeck);
            }
          } catch (stepErr) {
            console.error('[useAutoMixEngine] Transition step error:', stepErr);
          }
        }, 100);
      } catch (err) {
        console.error('[useAutoMixEngine] executeTransition error:', err);
        isTransitioningRef.current = false;
        setEngineState('PLAYING');
      }
    },
    [
      setCrossfaderSafe,
      setDeck1,
      setDeck2,
      setSessionHistory,
      onTransitionCompleted,
      queueNextTrackOnIdleDeck
    ]
  );

  // Manual Trigger helper
  const triggerManualTransition = useCallback(() => {
    if (isTransitioningRef.current || stateRef.current.manualTakeover) return;

    audioEngine.ensureRunning();
    audioEngine.unlockAllAudio();

    const isAnyPlaying = stateRef.current.deck1.isPlaying || stateRef.current.deck2.isPlaying;
    if (!isAnyPlaying) {
      const master = stateRef.current.activeMasterDeck;
      const setter = master === 1 ? setDeck1 : setDeck2;
      const bpm = master === 1 ? stateRef.current.deck1.bpm : stateRef.current.deck2.bpm;
      setter((d) => ({ ...d, isPlaying: true }));
      audioEngine.setDeckPlaying(master, true, bpm);
      setEngineState('PLAYING');
    }

    const outgoing = stateRef.current.activeMasterDeck;
    const incoming = outgoing === 1 ? 2 : 1;
    executeTransition(outgoing, incoming);
  }, [executeTransition, setDeck1, setDeck2]);

  // Deterministic Countdown Loop
  useEffect(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    const isAnyDeckPlaying = deck1.isPlaying || deck2.isPlaying;

    if (!isAnyDeckPlaying) {
      setEngineState('IDLE');
      return;
    }

    if (autoDjPaused || manualTakeover) {
      setEngineState('PAUSED');
      return;
    }

    if (djMode !== 'autopilot') {
      setEngineState('PLAYING');
      return;
    }

    countdownIntervalRef.current = setInterval(() => {
      if (isTransitioningRef.current) return;

      setAutoDjCountdown((prev) => {
        if (prev <= 1) {
          const outDeck = stateRef.current.activeMasterDeck;
          const inDeck = outDeck === 1 ? 2 : 1;
          executeTransition(outDeck, inDeck);
          return stateRef.current.blendIntervalSeconds;
        }

        if (prev <= 10) {
          setEngineState('BLEND_PRIMED');
        } else {
          setEngineState('PLAYING');
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [
    deck1.isPlaying,
    deck2.isPlaying,
    djMode,
    autoDjPaused,
    manualTakeover,
    executeTransition
  ]);

  return {
    engineState,
    isTransitionExecuting: isTransitioningRef.current,
    activeMasterDeck,
    autoDjCountdown,
    autoDjPaused,
    setAutoDjPaused,
    triggerManualTransition,
    queueNextTrackOnIdleDeck,
    setStemSafe,
    setEqSafe,
    setFilterSafe,
    setCrossfaderSafe
  };
}
