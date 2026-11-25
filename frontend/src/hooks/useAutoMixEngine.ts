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
  const [engineState, setEngineState] = useState<AutoMixState>('IDLE');
  const [activeMasterDeck, setActiveMasterDeck] = useState<1 | 2>(1);
  const [autoDjCountdown, setAutoDjCountdown] = useState<number>(blendIntervalSeconds);
  const [autoDjPaused, setAutoDjPaused] = useState<boolean>(false);

  const isTransitioningRef = useRef<boolean>(false);
  const transitionMetaRef = useRef<{ fromDeck: 1 | 2; toDeck: 1 | 2 } | null>(null);
  const transitionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const clamp01 = (val: number): number => {
    if (isNaN(val)) return 0.5;
    return Math.max(0.0, Math.min(1.0, val));
  };

  const clampEq = (val: number): number => {
    if (isNaN(val)) return 1.0;
    return Math.max(0.0, Math.min(2.0, val));
  };

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

  const setCrossfaderSafe = useCallback(
    (val: number) => {
      const safeVal = clamp01(val);
      setCrossfader(safeVal);
      audioEngine.setCrossfader(safeVal);
    },
    [setCrossfader]
  );

  useEffect(() => {
    if (lockedPlaylist) {
      if (transitionTimerRef.current) {
        clearInterval(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }
      audioEngine.cancelPendingStarts();
      setActiveMasterDeck(1);
      setAutoDjCountdown(blendIntervalSeconds);
      setAutoDjPaused(false);
      isTransitioningRef.current = false;
      transitionMetaRef.current = null;
      setCrossfaderSafe(0.0);
    }
  }, [lockedPlaylist, blendIntervalSeconds, setCrossfaderSafe]);

  // Update countdown when pacing interval changes while not transitioning
  useEffect(() => {
    if (!isTransitioningRef.current) {
      setAutoDjCountdown(blendIntervalSeconds);
    }
  }, [blendIntervalSeconds]);

  // Camelot wheel harmonic score (0.0 to 1.0)
  const calculateHarmonicScore = (key1: string, key2: string): number => {
    const parse = (k: string) => {
      const num = parseInt(k.replace(/[^\d]/g, ''), 10) || 1;
      const letter = k.toUpperCase().includes('B') ? 'B' : 'A';
      return { num: Math.max(1, Math.min(12, num)), letter };
    };
    const c1 = parse(key1);
    const c2 = parse(key2);
    if (c1.num === c2.num && c1.letter === c2.letter) return 1.0;
    const wheelDist = Math.min(Math.abs(c1.num - c2.num), 12 - Math.abs(c1.num - c2.num));
    if (c1.letter === c2.letter && wheelDist === 1) return 0.92;
    if (c1.num === c2.num && c1.letter !== c2.letter) return 0.85;
    if (c1.letter === c2.letter && wheelDist === 2) return 0.72;
    return 0.4;
  };

  const queueNextTrackOnIdleDeck = useCallback(
    (idleDeck: 1 | 2, currentMasterDeck: 1 | 2) => {
      const currentMasterTrack = currentMasterDeck === 1 ? stateRef.current.deck1.track : stateRef.current.deck2.track;
      if (!currentMasterTrack) return;

      const isLocked = !!stateRef.current.lockedPlaylist;
      const effectivePool = isLocked
        ? stateRef.current.lockedPlaylist!.tracks.filter((t) => !t.isUnavailable)
        : stateRef.current.libraryTracks;

      if (isLocked && stateRef.current.repeatPlaylist === false) {
        const playedIds = new Set(stateRef.current.sessionHistory.map((h) => h.track.id));
        playedIds.add(currentMasterTrack.id);
        const hasUnplayed = effectivePool.some((t) => !playedIds.has(t.id));
        if (!hasUnplayed) return;
      }

      const allPlayedIds = new Set(stateRef.current.sessionHistory.map((h) => h.track.id));
      allPlayedIds.add(currentMasterTrack.id);
      const unplayedPool = effectivePool.filter((t) => !allPlayedIds.has(t.id));

      let candidatePool: Track[];
      if (unplayedPool.length > 0) {
        candidatePool = unplayedPool;
      } else {
        if (isLocked && stateRef.current.repeatPlaylist === false) return;
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

  const executeTransition = useCallback(
    (fromDeck: 1 | 2, toDeck: 1 | 2) => {
      if (isTransitioningRef.current) return;
      isTransitioningRef.current = true;
      transitionMetaRef.current = { fromDeck, toDeck };
      setEngineState('TRANSITIONING');

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
        const isExtremeBpm = Math.abs(rawPitch) > 8.0;
        // If BPM gap is too large (> 8%), keep native tempo and use a clean phrase/drop transition
        const pitchPct = isExtremeBpm ? 0.0 : Math.max(-8.0, Math.min(8.0, rawPitch));

        audioEngine.setDeckPitch(toDeck, pitchPct);
        audioEngine.quantizedStart(fromDeck, toDeck, masterBpm, incomingCue);

        const incomingSetter = toDeck === 1 ? setDeck1 : setDeck2;
        incomingSetter((d) => ({
          ...d,
          isPlaying: true,
          eqLow: 0.0,
          eqMid: 0.85,
          eqHigh: 1.0,
          filter: 0.5,
          bpm: isExtremeBpm ? nativeBpm : masterBpm,
          pitchPct,
          stems: { vocal: 0.0, instruments: 1.0, bass: 0.0, drums: 1.0 }
        }));

        let step = 0;
        const totalSteps = isExtremeBpm ? 60 : 100; // 6s drop or 10s smooth blend
        const initialCf = stateRef.current.crossfader;
        const targetCf = toDeck === 1 ? 0.0 : 1.0;

        transitionTimerRef.current = setInterval(() => {
          try {
            step++;
            const progress = step / totalSteps;

            if (!isExtremeBpm) {
              audioEngine.lockPhase(fromDeck, toDeck, masterBpm, incomingCue);
            }

            // Constant-power S-curve crossfade
            const sProgress = 0.5 * (1 - Math.cos(progress * Math.PI));
            const currentCf = initialCf + (targetCf - initialCf) * sProgress;
            setCrossfaderSafe(currentCf);

            // Highpass riser on outgoing track before midpoint
            if (progress >= 0.25 && progress < 0.5) {
              const riserProgress = (progress - 0.25) / 0.25;
              const sweepVal = 0.5 + riserProgress * 0.36;
              const outSetter = fromDeck === 1 ? setDeck1 : setDeck2;
              outSetter((d) => ({ ...d, filter: sweepVal }));
            }

            // Downbeat Bass Swap at 50% midpoint
            if (progress >= 0.5) {
              const postMid = (progress - 0.5) / 0.5;
              // Gently ramp incoming pitch back to 0% after midpoint
              const rampedPitch = pitchPct * (1 - postMid);
              audioEngine.setDeckPitch(toDeck, rampedPitch);

              if (toDeck === 1) {
                setDeck1((d) => ({
                  ...d,
                  eqLow: 1.0,
                  filter: 0.5,
                  pitchPct: rampedPitch,
                  bpm: nativeBpm * (1 + rampedPitch / 100),
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
                  pitchPct: rampedPitch,
                  bpm: nativeBpm * (1 + rampedPitch / 100),
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

            if (step >= totalSteps) {
              if (transitionTimerRef.current) {
                clearInterval(transitionTimerRef.current);
                transitionTimerRef.current = null;
              }

              isTransitioningRef.current = false;
              transitionMetaRef.current = null;
              setCrossfaderSafe(targetCf);

              audioEngine.setDeckPlaying(fromDeck, false);
              audioEngine.setDeckPitch(toDeck, 0);

              const fromSetter = fromDeck === 1 ? setDeck1 : setDeck2;
              fromSetter((d) => ({
                ...d,
                isPlaying: false,
                filter: 0.5,
                eqLow: 1.0,
                pitchPct: 0,
                stems: { vocal: 1.0, instruments: 1.0, bass: 1.0, drums: 1.0 }
              }));

              const toSetter = toDeck === 1 ? setDeck1 : setDeck2;
              toSetter((d) => ({
                ...d,
                pitchPct: 0,
                bpm: d.track?.bpm || d.bpm,
                filter: 0.5,
                eqLow: 1.0
              }));

              setActiveMasterDeck(toDeck);
              setEngineState('PLAYING');
              setAutoDjCountdown(stateRef.current.blendIntervalSeconds);

              const playedTrack = toDeck === 1 ? stateRef.current.deck1.track : stateRef.current.deck2.track;
              if (playedTrack) {
                const newHistoryItem: SessionHistoryItem = {
                  id: `hist_${Date.now()}`,
                  track: playedTrack,
                  deck: toDeck,
                  playedAt: new Date().toLocaleTimeString(),
                  transitionType: isExtremeBpm ? 'PHRASE DROP CUT' : '32-BEAT BEAT-MATCHED BLEND',
                  durationSec: isExtremeBpm ? 6 : 10
                };
                setSessionHistory((h) => [newHistoryItem, ...h]);
              }

              if (onTransitionCompleted) {
                onTransitionCompleted();
              }

              queueNextTrackOnIdleDeck(fromDeck, toDeck);
            }
          } catch (stepErr) {
            console.error('[useAutoMixEngine] Transition step error:', stepErr);
          }
        }, 100);
      } catch (err) {
        console.error('[useAutoMixEngine] executeTransition error:', err);
        isTransitioningRef.current = false;
        transitionMetaRef.current = null;
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

  // Cleanly abort an active crossfade and snap to target deck, or cycle the cued track
  const skipToNextTrack = useCallback(() => {
    audioEngine.cancelPendingStarts();

    if (isTransitioningRef.current && transitionMetaRef.current) {
      if (transitionTimerRef.current) {
        clearInterval(transitionTimerRef.current);
        transitionTimerRef.current = null;
      }

      const { fromDeck, toDeck } = transitionMetaRef.current;
      isTransitioningRef.current = false;
      transitionMetaRef.current = null;

      const targetCf = toDeck === 1 ? 0.0 : 1.0;
      setCrossfaderSafe(targetCf);

      audioEngine.setDeckPlaying(fromDeck, false);
      audioEngine.setDeckPitch(toDeck, 0);
      audioEngine.setDeckPlaying(toDeck, true);

      const fromSetter = fromDeck === 1 ? setDeck1 : setDeck2;
      fromSetter((d) => ({
        ...d,
        isPlaying: false,
        filter: 0.5,
        eqLow: 1.0,
        pitchPct: 0,
        stems: { vocal: 1.0, instruments: 1.0, bass: 1.0, drums: 1.0 }
      }));

      const toSetter = toDeck === 1 ? setDeck1 : setDeck2;
      toSetter((d) => ({
        ...d,
        isPlaying: true,
        filter: 0.5,
        eqLow: 1.0,
        eqMid: 1.0,
        eqHigh: 1.0,
        pitchPct: 0,
        bpm: d.track?.bpm || d.bpm,
        stems: { vocal: 1.0, instruments: 1.0, bass: 1.0, drums: 1.0 }
      }));

      setActiveMasterDeck(toDeck);
      setEngineState('PLAYING');
      setAutoDjCountdown(stateRef.current.blendIntervalSeconds);
      queueNextTrackOnIdleDeck(fromDeck, toDeck);
      return;
    }

    const master = stateRef.current.activeMasterDeck;
    const idle = master === 1 ? 2 : 1;
    queueNextTrackOnIdleDeck(idle, master);
  }, [setCrossfaderSafe, setDeck1, setDeck2, queueNextTrackOnIdleDeck]);

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

  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) clearInterval(transitionTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      audioEngine.cancelPendingStarts();
    };
  }, []);

  return {
    engineState,
    isTransitionExecuting: isTransitioningRef.current,
    activeMasterDeck,
    autoDjCountdown,
    autoDjPaused,
    setAutoDjPaused,
    triggerManualTransition,
    skipToNextTrack,
    queueNextTrackOnIdleDeck,
    setStemSafe,
    setEqSafe,
    setFilterSafe,
    setCrossfaderSafe
  };
}
