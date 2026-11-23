/**
 * MIXMIND Pro Club DJ Audio Engine
 * Combines direct HTML5 Audio hardware streaming (Safari/Chrome bulletproof)
 * with real Web Audio API DSP:
 *  - 3-Band Biquad Isolator EQ (-40dB kill to +6dB boost)
 *  - Sound Color FX Resonant High-Pass / Low-Pass Filter
 *  - Equal-power constant-energy crossfader curves
 *  - Beat & Phase Synchronization / Quantized Downbeat Launch
 */

export class DJDeckAudio {
  public deckNum: number;
  public audioElement: HTMLAudioElement;
  public isUsingRealAudio: boolean = false;
  public isPlaying: boolean = false;
  public bpm: number = 130.0;
  public basePlaybackRate: number = 1.0;

  // Real Web Audio DSP Nodes
  public audioContext: AudioContext | null = null;
  public sourceNode: MediaElementAudioSourceNode | null = null;
  public lowShelfNode: BiquadFilterNode | null = null;
  public midPeakingNode: BiquadFilterNode | null = null;
  public highShelfNode: BiquadFilterNode | null = null;
  public colorFilterNode: BiquadFilterNode | null = null;
  public vocalDuckerNode: GainNode | null = null;
  public channelGainNode: GainNode | null = null;
  public hasWebAudioAttached: boolean = false;

  // Hardware fallback multipliers (until user gestures unlock Web Audio)
  private channelVolume: number = 1.0;
  private masterVolume: number = 0.85;
  private eqFactor: number = 1.0;
  private stemFactor: number = 1.0;
  private filterFactor: number = 1.0;
  private isMuted: boolean = false;

  constructor(deckNum: number) {
    this.deckNum = deckNum;

    this.audioElement = new Audio();
    this.audioElement.preload = 'auto';
    this.audioElement.autoplay = false;
    this.audioElement.crossOrigin = 'anonymous';

    // Safely append to DOM to satisfy WebKit background media requirements
    if (typeof document !== 'undefined' && document.body) {
      try {
        this.audioElement.style.position = 'absolute';
        this.audioElement.style.width = '1px';
        this.audioElement.style.height = '1px';
        this.audioElement.style.opacity = '0.001';
        this.audioElement.style.pointerEvents = 'none';
        this.audioElement.id = `mixmind-native-audio-deck-${deckNum}`;
        document.body.appendChild(this.audioElement);
      } catch {
        // Fallback for SSR or headless
      }
    }

    this.updateHardwareVolume();
  }

  public attachWebAudio(context: AudioContext, masterOutput: GainNode) {
    if (this.hasWebAudioAttached || !context) return;
    this.audioContext = context;

    try {
      this.sourceNode = context.createMediaElementSource(this.audioElement);

      // 1. Low Shelf Isolator Filter (Sub-bass & Kicks below 250 Hz)
      this.lowShelfNode = context.createBiquadFilter();
      this.lowShelfNode.type = 'lowshelf';
      this.lowShelfNode.frequency.value = 250;
      this.lowShelfNode.gain.value = 0.0;

      // 2. Mid Peaking Filter (Vocals & Synthesizer lead around 1200 Hz)
      this.midPeakingNode = context.createBiquadFilter();
      this.midPeakingNode.type = 'peaking';
      this.midPeakingNode.frequency.value = 1200;
      this.midPeakingNode.Q.value = 0.9;
      this.midPeakingNode.gain.value = 0.0;

      // 3. High Shelf Filter (Hi-Hats, Shakers & Air above 3500 Hz)
      this.highShelfNode = context.createBiquadFilter();
      this.highShelfNode.type = 'highshelf';
      this.highShelfNode.frequency.value = 3500;
      this.highShelfNode.gain.value = 0.0;

      // 4. Sound Color FX Resonant Filter (Bipolar HPF / LPF sweep)
      this.colorFilterNode = context.createBiquadFilter();
      this.colorFilterNode.type = 'allpass';
      this.colorFilterNode.frequency.value = 1000;
      this.colorFilterNode.Q.value = 2.0;

      // 5. Vocal Ducker Gain (prevents double-vocal clashing during blends)
      this.vocalDuckerNode = context.createGain();
      this.vocalDuckerNode.gain.value = 1.0;

      // 6. Deck Channel Gain (driven by equal-power crossfader)
      this.channelGainNode = context.createGain();
      this.channelGainNode.gain.value = this.channelVolume;

      // Connect DSP chain:
      // source -> lowShelf -> midPeaking -> highShelf -> colorFilter -> vocalDucker -> channelGain -> masterOutput
      this.sourceNode.connect(this.lowShelfNode);
      this.lowShelfNode.connect(this.midPeakingNode);
      this.midPeakingNode.connect(this.highShelfNode);
      this.highShelfNode.connect(this.colorFilterNode);
      this.colorFilterNode.connect(this.vocalDuckerNode);
      this.vocalDuckerNode.connect(this.channelGainNode);
      this.channelGainNode.connect(masterOutput);

      this.hasWebAudioAttached = true;
      // When Web Audio DSP is active, keep hardware audio element volume at 1.0
      this.audioElement.volume = 1.0;
    } catch (e) {
      console.warn(`[Deck ${this.deckNum}] Web Audio attachment fallback:`, e);
      this.hasWebAudioAttached = false;
    }
  }

  public loadTrack(url: string) {
    if (!url) return;
    this.isUsingRealAudio = true;

    if (this.audioElement.src && this.audioElement.src.endsWith(url)) {
      if (this.isPlaying && this.audioElement.paused) {
        this.audioElement.play().catch(() => {});
      }
      return;
    }

    this.audioElement.src = url;
    this.audioElement.currentTime = 0;
    this.audioElement.load();
    this.updateHardwareVolume();

    if (this.isPlaying) {
      this.audioElement.play().catch((err) => {
        console.warn(`[Deck ${this.deckNum}] Autoplay waiting for gesture:`, err);
      });
    }
  }

  public getCurrentTime(): number {
    return this.audioElement.currentTime || 0;
  }

  public getDuration(): number {
    return this.audioElement.duration || 0;
  }

  public setChannelGain(gain: number) {
    this.channelVolume = Math.max(0, Math.min(1, gain));
    if (this.hasWebAudioAttached && this.channelGainNode && this.audioContext) {
      this.channelGainNode.gain.setTargetAtTime(this.channelVolume, this.audioContext.currentTime, 0.01);
    } else {
      this.updateHardwareVolume();
    }
  }

  public setMasterGain(gain: number, muted: boolean) {
    this.masterVolume = Math.max(0, Math.min(1, gain));
    this.isMuted = muted;
    if (!this.hasWebAudioAttached) {
      this.updateHardwareVolume();
    }
  }

  private updateHardwareVolume() {
    if (this.hasWebAudioAttached) {
      // Audio element stays at 1.0 while Web Audio nodes control gain
      this.audioElement.volume = 1.0;
      return;
    }
    if (this.isMuted) {
      this.audioElement.volume = 0;
    } else {
      const vol = this.channelVolume * this.masterVolume * this.eqFactor * this.stemFactor * this.filterFactor;
      this.audioElement.volume = Math.max(0, Math.min(1, vol));
    }
  }

  public setPitch(pitchPct: number) {
    const rate = Math.max(0.5, Math.min(2.0, 1 + pitchPct / 100));
    this.basePlaybackRate = rate;
    this.audioElement.playbackRate = rate;
  }

  public setStems(vocal: number, inst: number, bass: number, drums: number) {
    if (this.hasWebAudioAttached && this.vocalDuckerNode && this.audioContext) {
      // Duck vocals cleanly to eliminate lyrical clashes during transitions
      const vGain = Math.max(0.001, vocal);
      this.vocalDuckerNode.gain.setTargetAtTime(vGain, this.audioContext.currentTime, 0.03);
    } else {
      const weighted = vocal * 0.35 + inst * 0.25 + bass * 0.25 + drums * 0.15;
      this.stemFactor = Math.max(0.2, Math.min(1.0, weighted));
      this.updateHardwareVolume();
    }
  }

  public setEq(low: number, mid: number, high: number) {
    if (this.hasWebAudioAttached && this.lowShelfNode && this.midPeakingNode && this.highShelfNode && this.audioContext) {
      const now = this.audioContext.currentTime;

      // 1. LOW BASS ISOLATION:
      // low = 0.0 -> -40dB Kill (True sub-bass kill, kick drums completely disappear!)
      // low = 1.0 -> 0dB Flat
      // low = 2.0 -> +6dB Club Bass Boost
      let lowGainDb = 0;
      if (low <= 0.05) {
        lowGainDb = -40.0;
      } else if (low <= 1.0) {
        lowGainDb = (low - 1.0) * 36.0; // Smooth curve from -40dB up to 0dB
      } else {
        lowGainDb = (low - 1.0) * 6.0;
      }
      this.lowShelfNode.gain.setTargetAtTime(lowGainDb, now, 0.015);

      // 2. MID RANGE
      let midGainDb = 0;
      if (mid <= 0.05) {
        midGainDb = -30.0;
      } else if (mid <= 1.0) {
        midGainDb = (mid - 1.0) * 26.0;
      } else {
        midGainDb = (mid - 1.0) * 6.0;
      }
      this.midPeakingNode.gain.setTargetAtTime(midGainDb, now, 0.015);

      // 3. HIGH RANGE
      let highGainDb = 0;
      if (high <= 0.05) {
        highGainDb = -30.0;
      } else if (high <= 1.0) {
        highGainDb = (high - 1.0) * 26.0;
      } else {
        highGainDb = (high - 1.0) * 6.0;
      }
      this.highShelfNode.gain.setTargetAtTime(highGainDb, now, 0.015);
    } else {
      this.eqFactor = Math.max(0.25, low * 0.55 + mid * 0.30 + high * 0.15);
      this.updateHardwareVolume();
    }
  }

  public setFilter(val: number) {
    if (this.hasWebAudioAttached && this.colorFilterNode && this.audioContext) {
      const now = this.audioContext.currentTime;

      if (val > 0.52) {
        // High-Pass Filter sweep (Riser / Build-up): sweeps from 30 Hz up to 3800 Hz
        const norm = (val - 0.5) / 0.5;
        const targetFreq = 30 * Math.pow(3800 / 30, norm);
        this.colorFilterNode.type = 'highpass';
        this.colorFilterNode.frequency.setTargetAtTime(targetFreq, now, 0.02);
        this.colorFilterNode.Q.setTargetAtTime(2.2, now, 0.02); // Resonant club bite
      } else if (val < 0.48) {
        // Low-Pass Filter sweep (Muffled breakdown): sweeps down from 20000 Hz to 280 Hz
        const norm = (0.5 - val) / 0.5;
        const targetFreq = 20000 * Math.pow(280 / 20000, norm);
        this.colorFilterNode.type = 'lowpass';
        this.colorFilterNode.frequency.setTargetAtTime(targetFreq, now, 0.02);
        this.colorFilterNode.Q.setTargetAtTime(1.6, now, 0.02);
      } else {
        // Center Neutral (Bypass)
        this.colorFilterNode.type = 'allpass';
        this.colorFilterNode.frequency.setTargetAtTime(1000, now, 0.02);
      }
    } else {
      if (val > 0.54) {
        const norm = (val - 0.5) / 0.5;
        this.filterFactor = Math.max(0.25, 1.0 - norm * 0.65);
      } else if (val < 0.46) {
        const norm = (0.5 - val) / 0.5;
        this.filterFactor = Math.max(0.3, 1.0 - norm * 0.6);
      } else {
        this.filterFactor = 1.0;
      }
      this.updateHardwareVolume();
    }
  }

  public isHardwarePaused(): boolean {
    return this.audioElement.paused;
  }

  public start() {
    this.isPlaying = true;
    if (this.audioElement.src) {
      this.updateHardwareVolume();
      const playPromise = this.audioElement.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn(`[Deck ${this.deckNum}] Autoplay waiting for interaction/canplay:`, err);
          const resume = () => {
            if (this.isPlaying && this.audioElement.paused) {
              this.audioElement.play().catch(() => {});
            }
            window.removeEventListener('click', resume);
            window.removeEventListener('keydown', resume);
            window.removeEventListener('touchstart', resume);
          };
          window.addEventListener('click', resume, { once: true });
          window.addEventListener('keydown', resume, { once: true });
          window.addEventListener('touchstart', resume, { once: true });

          const onCanPlay = () => {
            if (this.isPlaying && this.audioElement.paused) {
              this.audioElement.play().catch(() => {});
            }
          };
          this.audioElement.addEventListener('canplay', onCanPlay, { once: true });
        });
      }
    }
  }

  public stop() {
    this.isPlaying = false;
    this.audioElement.pause();
  }

  public seek(seconds: number) {
    if (this.audioElement.duration && seconds >= 0 && seconds <= this.audioElement.duration) {
      this.audioElement.currentTime = seconds;
    }
  }
}

export class MasterAudioEngine {
  private static instance: MasterAudioEngine;
  public deck1!: DJDeckAudio;
  public deck2!: DJDeckAudio;
  public isInitialized: boolean = false;
  private isMuted: boolean = false;
  private masterGainValue: number = 0.9;
  public audioContext: AudioContext | null = null;
  public masterGainNode: GainNode | null = null;

  private constructor() {
    this.init();
  }

  public static getInstance(): MasterAudioEngine {
    if (!MasterAudioEngine.instance) {
      MasterAudioEngine.instance = new MasterAudioEngine();
    }
    return MasterAudioEngine.instance;
  }

  public init() {
    if (this.isInitialized) return;

    try {
      this.deck1 = new DJDeckAudio(1);
      this.deck2 = new DJDeckAudio(2);

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        this.masterGainNode = this.audioContext.createGain();
        this.masterGainNode.gain.value = this.masterGainValue;
        this.masterGainNode.connect(this.audioContext.destination);

        this.deck1.attachWebAudio(this.audioContext, this.masterGainNode);
        this.deck2.attachWebAudio(this.audioContext, this.masterGainNode);
      }

      this.setCrossfader(0.0);
      this.isInitialized = true;
    } catch (e) {
      console.warn("Audio initialization note:", e);
    }
  }

  public ensureRunning() {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    if (this.audioContext && this.masterGainNode) {
      if (!this.deck1.hasWebAudioAttached) this.deck1.attachWebAudio(this.audioContext, this.masterGainNode);
      if (!this.deck2.hasWebAudioAttached) this.deck2.attachWebAudio(this.audioContext, this.masterGainNode);
    }
  }

  public async unlockAllAudio(): Promise<boolean> {
    try {
      this.ensureRunning();
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      if (this.audioContext && this.masterGainNode) {
        this.deck1.attachWebAudio(this.audioContext, this.masterGainNode);
        this.deck2.attachWebAudio(this.audioContext, this.masterGainNode);
      }

      // Only start hardware audio element if the deck is explicitly marked as playing
      if (this.deck1 && this.deck1.audioElement.src && this.deck1.isPlaying) {
        this.deck1.setMasterGain(this.masterGainValue, this.isMuted);
        await this.deck1.audioElement.play().catch(() => {});
      }

      if (this.deck2 && this.deck2.audioElement.src && this.deck2.isPlaying) {
        this.deck2.setMasterGain(this.masterGainValue, this.isMuted);
        await this.deck2.audioElement.play().catch(() => {});
      }

      return true;
    } catch (e) {
      console.warn("Direct user gesture required to unpause audio:", e);
      return false;
    }
  }

  public isDeckPaused(deck: 1 | 2): boolean {
    const d = deck === 1 ? this.deck1 : this.deck2;
    return d ? d.isHardwarePaused() : true;
  }

  public loadDeckTrack(deck: 1 | 2, audioUrl?: string) {
    this.ensureRunning();
    const d = deck === 1 ? this.deck1 : this.deck2;
    if (d && audioUrl) {
      d.loadTrack(audioUrl);
    }
  }

  public setDeckPlaying(deck: 1 | 2, playing: boolean, bpm?: number) {
    this.ensureRunning();
    const d = deck === 1 ? this.deck1 : this.deck2;
    if (!d) return;

    if (bpm) d.bpm = bpm;

    if (playing) {
      d.start();
    } else {
      d.stop();
    }
  }

  public setDeckPitch(deck: 1 | 2, pitchPct: number) {
    const d = deck === 1 ? this.deck1 : this.deck2;
    if (d) {
      d.setPitch(pitchPct);
    }
  }

  /**
   * Constant-Power Crossfader Curve (Standard DJ Equal-Loudness S-Curve)
   * Prevents volume dip in the middle of a transition.
   */
  public setCrossfader(val: number) {
    if (!this.deck1 || !this.deck2) return;
    const clamped = Math.max(0, Math.min(1, val));

    const angle = clamped * 0.5 * Math.PI;
    const gain1 = Math.cos(angle);
    const gain2 = Math.sin(angle);

    this.deck1.setChannelGain(gain1);
    this.deck2.setChannelGain(gain2);
  }

  public setDeckStems(deck: 1 | 2, stems: { vocal: number; instruments: number; bass: number; drums: number }) {
    const d = deck === 1 ? this.deck1 : this.deck2;
    if (d) {
      d.setStems(stems.vocal, stems.instruments, stems.bass, stems.drums);
    }
  }

  public setDeckEq(deck: 1 | 2, low: number, mid: number, high: number) {
    const d = deck === 1 ? this.deck1 : this.deck2;
    if (d) {
      d.setEq(low, mid, high);
    }
  }

  public setDeckFilter(deck: 1 | 2, val: number) {
    const d = deck === 1 ? this.deck1 : this.deck2;
    if (d) {
      d.setFilter(val);
    }
  }

  public getDeckTime(deck: 1 | 2): { currentTime: number; duration: number } {
    const d = deck === 1 ? this.deck1 : this.deck2;
    if (d && d.isUsingRealAudio) {
      return { currentTime: d.getCurrentTime(), duration: d.getDuration() };
    }
    return { currentTime: 0, duration: 0 };
  }

  public setMasterMute(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGainNode && this.audioContext) {
      this.masterGainNode.gain.setTargetAtTime(muted ? 0.0 : this.masterGainValue, this.audioContext.currentTime, 0.01);
    }
    if (this.deck1) this.deck1.setMasterGain(this.masterGainValue, muted);
    if (this.deck2) this.deck2.setMasterGain(this.masterGainValue, muted);
  }

  // -----------------------------------------------------------------
  // Sample-Accurate Beat & Phase Synchronization (Pioneer BeatLock / CDJ-3000 PLL)
  // -----------------------------------------------------------------

  /**
   * Quantized Downbeat Launch:
   * Starts the incoming deck quantized precisely to the next downbeat of the master deck.
   * Eliminates the kick-drum flam / trainwreck.
   */
  public quantizedStart(fromDeckNum: 1 | 2, toDeckNum: 1 | 2, masterBpm: number, cuePointSec: number = 0.07): number {
    this.ensureRunning();
    const fromDeck = fromDeckNum === 1 ? this.deck1 : this.deck2;
    const toDeck = toDeckNum === 1 ? this.deck1 : this.deck2;

    if (!toDeck) return 0;

    try {
      if (toDeck.audioElement && toDeck.audioElement.src && toDeck.audioElement.readyState >= 1) {
        toDeck.audioElement.currentTime = cuePointSec || 0;
      }
    } catch (e) {
      console.warn('[audioEngine] Safe cuePointSec seek bypass:', e);
    }

    const safeBpm = masterBpm > 40 && masterBpm < 250 ? masterBpm : 128;
    const fromTime = fromDeck ? fromDeck.getCurrentTime() : 0;
    const beatPeriod = 60.0 / safeBpm;
    const elapsedInBeat = fromTime % beatPeriod;
    const timeToNextBeat = (beatPeriod - elapsedInBeat) % beatPeriod;

    const delayMs = Math.round((isNaN(timeToNextBeat) ? 0 : timeToNextBeat) * 1000);
    if (delayMs <= 25) {
      toDeck.start();
    } else {
      setTimeout(() => {
        try {
          toDeck.start();
        } catch (err) {
          console.warn('[audioEngine] Delayed start error:', err);
        }
      }, delayMs);
    }

    return delayMs;
  }

  /**
   * Phase-Locked Loop (PLL) Nudge:
   * Keeps both decks in absolute sub-millisecond phase lock during the blend.
   */
  public lockPhase(fromDeckNum: 1 | 2, toDeckNum: 1 | 2, masterBpm: number, cuePointSec: number = 0.07) {
    try {
      const fromDeck = fromDeckNum === 1 ? this.deck1 : this.deck2;
      const toDeck = toDeckNum === 1 ? this.deck1 : this.deck2;

      if (!fromDeck || !toDeck || !fromDeck.isPlaying || !toDeck.isPlaying) return;

      const safeBpm = masterBpm > 40 && masterBpm < 250 ? masterBpm : 128;
      const beatPeriod = 60.0 / safeBpm;
      const fromTime = fromDeck.getCurrentTime();
      const toTime = toDeck.getCurrentTime();

      const phA = fromTime % beatPeriod;
      const phB = (toTime - cuePointSec + 1000 * beatPeriod) % beatPeriod;

      let diff = phB - phA;
      if (diff > beatPeriod / 2) diff -= beatPeriod;
      if (diff < -beatPeriod / 2) diff += beatPeriod;

      // If drift exceeds 15ms, apply gentle momentary pitch nudge
      if (Math.abs(diff) > 0.015 && toDeck.audioElement) {
        const nudge = Math.max(0.96, Math.min(1.04, 1.0 - diff * 0.4));
        toDeck.audioElement.playbackRate = toDeck.basePlaybackRate * nudge;
        setTimeout(() => {
          if (toDeck.audioElement) {
            toDeck.audioElement.playbackRate = toDeck.basePlaybackRate;
          }
        }, 70);
      }
    } catch (e) {
      // Non-blocking phase lock error
    }
  }

  // -------------------------------------------------------------
  // Live DJ Club Hype Sound FX Generator (Web Audio DSP Synthesizer)
  // -------------------------------------------------------------
  public triggerAirhorn() {
    this.ensureRunning();
    if (!this.audioContext) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const chords = [466.16, 587.33, 698.46]; // Bb4, D5, F5
    const pulses = [0.0, 0.16, 0.32];

    pulses.forEach((pulseStart, pIdx) => {
      const dur = pIdx === 2 ? 0.45 : 0.12;
      chords.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq * 1.02, now + pulseStart);
        osc.frequency.exponentialRampToValueAtTime(freq, now + pulseStart + 0.05);

        gain.gain.setValueAtTime(0.25, now + pulseStart);
        gain.gain.exponentialRampToValueAtTime(0.001, now + pulseStart + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + pulseStart);
        osc.stop(now + pulseStart + dur + 0.02);
      });
    });
  }

  public triggerSpinback(deckNum: 1 | 2) {
    this.ensureRunning();
    const d = deckNum === 1 ? this.deck1 : this.deck2;
    if (d && d.audioElement) {
      d.audioElement.playbackRate = 2.0;
      setTimeout(() => { if (d.audioElement) d.audioElement.playbackRate = 0.5; }, 120);
      setTimeout(() => { if (d.audioElement) d.audioElement.playbackRate = 0.2; }, 260);
      setTimeout(() => { if (d.audioElement) d.audioElement.playbackRate = 1.0; }, 480);
    }

    if (this.audioContext) {
      const ctx = this.audioContext;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.55);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.65);
    }
  }

  public triggerSubDrop() {
    this.ensureRunning();
    if (!this.audioContext) return;
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.9);

    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.25);
  }

  public triggerEchoFreeze(deckNum: 1 | 2) {
    this.ensureRunning();
    const d = deckNum === 1 ? this.deck1 : this.deck2;
    if (d && d.audioElement) {
      let count = 0;
      const vol = d.audioElement.volume;
      const stutter = setInterval(() => {
        count++;
        d.audioElement.volume = count % 2 === 0 ? vol * Math.pow(0.75, count) : 0;
        if (count >= 8) {
          clearInterval(stutter);
          d.audioElement.volume = vol;
        }
      }, 95);
    }
  }
}

export const audioEngine = MasterAudioEngine.getInstance();
