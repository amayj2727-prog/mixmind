/**
 * MIXMIND Pro Club DJ Audio Engine
 * Single shared AudioContext singleton combining HTML5 Audio streaming
 * with real Web Audio API DSP:
 *  - DynamicsCompressorNode Master Limiter (zero clipping on FX & dual-deck blends)
 *  - Shared AnalyserNode for live frequency-driven waveform animations
 *  - 3-Band Biquad Isolator EQ (-40dB kill to +6dB boost)
 *  - Sound Color FX Resonant High-Pass / Low-Pass Filter
 *  - Equal-power constant-energy crossfader curves
 *  - Beat & Phase Synchronization / Quantized Downbeat Launch
 *  - Leak-free Preview & Landing Demo channel
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
  private gestureListenersAttached: boolean = false;

  constructor(deckNum: number) {
    this.deckNum = deckNum;

    this.audioElement = new Audio();
    this.audioElement.preload = 'auto';
    this.audioElement.autoplay = false;
    this.audioElement.crossOrigin = 'anonymous';

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

  public attachWebAudio(context: AudioContext, masterOutput: AudioNode) {
    if (this.hasWebAudioAttached || !context) return;
    this.audioContext = context;

    try {
      this.sourceNode = context.createMediaElementSource(this.audioElement);

      // 1. Low Shelf Isolator Filter (Sub-bass & Kicks below 250 Hz)
      this.lowShelfNode = context.createBiquadFilter();
      this.lowShelfNode.type = 'lowshelf';
      this.lowShelfNode.frequency.value = 250;
      this.lowShelfNode.gain.value = 0.0;

      // 2. Mid Peaking Filter (Vocals & Synth lead around 1200 Hz)
      this.midPeakingNode = context.createBiquadFilter();
      this.midPeakingNode.type = 'peaking';
      this.midPeakingNode.frequency.value = 1200;
      this.midPeakingNode.Q.value = 0.9;
      this.midPeakingNode.gain.value = 0.0;

      // 3. High Shelf Filter (Hi-Hats & Air above 3500 Hz)
      this.highShelfNode = context.createBiquadFilter();
      this.highShelfNode.type = 'highshelf';
      this.highShelfNode.frequency.value = 3500;
      this.highShelfNode.gain.value = 0.0;

      // 4. Sound Color FX Resonant Filter (Bipolar HPF / LPF sweep)
      this.colorFilterNode = context.createBiquadFilter();
      this.colorFilterNode.type = 'allpass';
      this.colorFilterNode.frequency.value = 1000;
      this.colorFilterNode.Q.value = 2.0;

      // 5. Vocal Ducker Gain
      this.vocalDuckerNode = context.createGain();
      this.vocalDuckerNode.gain.value = 1.0;

      // 6. Deck Channel Gain (driven by equal-power crossfader)
      this.channelGainNode = context.createGain();
      this.channelGainNode.gain.value = this.channelVolume;

      // Connect DSP chain
      this.sourceNode.connect(this.lowShelfNode);
      this.lowShelfNode.connect(this.midPeakingNode);
      this.midPeakingNode.connect(this.highShelfNode);
      this.highShelfNode.connect(this.colorFilterNode);
      this.colorFilterNode.connect(this.vocalDuckerNode);
      this.vocalDuckerNode.connect(this.channelGainNode);
      this.channelGainNode.connect(masterOutput);

      this.hasWebAudioAttached = true;
      this.audioElement.volume = 1.0;
    } catch (e) {
      console.warn(`[Deck ${this.deckNum}] Web Audio attachment fallback:`, e);
      this.hasWebAudioAttached = false;
    }
  }

  public cancelScheduledAutomations() {
    if (!this.hasWebAudioAttached || !this.audioContext) return;
    const now = this.audioContext.currentTime;
    try {
      this.lowShelfNode?.gain.cancelScheduledValues(now);
      this.midPeakingNode?.gain.cancelScheduledValues(now);
      this.highShelfNode?.gain.cancelScheduledValues(now);
      this.colorFilterNode?.frequency.cancelScheduledValues(now);
      this.colorFilterNode?.Q.cancelScheduledValues(now);
      this.vocalDuckerNode?.gain.cancelScheduledValues(now);
      this.channelGainNode?.gain.cancelScheduledValues(now);
    } catch {
      // Ignore if context is closed
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

    this.cancelScheduledAutomations();
    this.audioElement.pause();
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
      const now = this.audioContext.currentTime;
      this.channelGainNode.gain.cancelScheduledValues(now);
      this.channelGainNode.gain.setTargetAtTime(this.channelVolume, now, 0.01);
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
    const clampedPct = Math.max(-8.0, Math.min(8.0, pitchPct));
    const rate = Math.max(0.5, Math.min(2.0, 1 + clampedPct / 100));
    this.basePlaybackRate = rate;
    this.audioElement.playbackRate = rate;
  }

  public setStems(vocal: number, inst: number, bass: number, drums: number) {
    if (this.hasWebAudioAttached && this.vocalDuckerNode && this.audioContext) {
      const now = this.audioContext.currentTime;
      const vGain = Math.max(0.001, Math.min(1.0, vocal));
      this.vocalDuckerNode.gain.setTargetAtTime(vGain, now, 0.03);
    } else {
      const weighted = vocal * 0.35 + inst * 0.25 + bass * 0.25 + drums * 0.15;
      this.stemFactor = Math.max(0.2, Math.min(1.0, weighted));
      this.updateHardwareVolume();
    }
  }

  public setEq(low: number, mid: number, high: number) {
    if (this.hasWebAudioAttached && this.lowShelfNode && this.midPeakingNode && this.highShelfNode && this.audioContext) {
      const now = this.audioContext.currentTime;

      let lowGainDb = 0;
      if (low <= 0.05) {
        lowGainDb = -40.0;
      } else if (low <= 1.0) {
        lowGainDb = (low - 1.0) * 36.0;
      } else {
        lowGainDb = (low - 1.0) * 6.0;
      }
      this.lowShelfNode.gain.setTargetAtTime(lowGainDb, now, 0.015);

      let midGainDb = 0;
      if (mid <= 0.05) {
        midGainDb = -30.0;
      } else if (mid <= 1.0) {
        midGainDb = (mid - 1.0) * 26.0;
      } else {
        midGainDb = (mid - 1.0) * 6.0;
      }
      this.midPeakingNode.gain.setTargetAtTime(midGainDb, now, 0.015);

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
      this.eqFactor = Math.max(0.25, low * 0.55 + mid * 0.3 + high * 0.15);
      this.updateHardwareVolume();
    }
  }

  public setFilter(val: number) {
    if (this.hasWebAudioAttached && this.colorFilterNode && this.audioContext) {
      const now = this.audioContext.currentTime;

      if (val > 0.52) {
        const norm = (val - 0.5) / 0.5;
        const targetFreq = 30 * Math.pow(3800 / 30, norm);
        this.colorFilterNode.type = 'highpass';
        this.colorFilterNode.frequency.setTargetAtTime(targetFreq, now, 0.02);
        this.colorFilterNode.Q.setTargetAtTime(2.2, now, 0.02);
      } else if (val < 0.48) {
        const norm = (0.5 - val) / 0.5;
        const targetFreq = 20000 * Math.pow(280 / 20000, norm);
        this.colorFilterNode.type = 'lowpass';
        this.colorFilterNode.frequency.setTargetAtTime(targetFreq, now, 0.02);
        this.colorFilterNode.Q.setTargetAtTime(1.6, now, 0.02);
      } else {
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
          if (!this.gestureListenersAttached) {
            this.gestureListenersAttached = true;
            const resume = () => {
              this.gestureListenersAttached = false;
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
          }

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
    this.cancelScheduledAutomations();
    this.audioElement.pause();
    this.audioElement.playbackRate = this.basePlaybackRate;
  }

  public seek(seconds: number) {
    this.cancelScheduledAutomations();
    if (this.audioElement.duration && seconds >= 0 && seconds <= this.audioElement.duration) {
      this.audioElement.currentTime = seconds;
    } else if (seconds === 0) {
      this.audioElement.currentTime = 0;
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
  public masterLimiterNode: DynamicsCompressorNode | null = null;
  public analyserNode: AnalyserNode | null = null;

  // Timers & active nodes tracking (prevents overlaps & memory leaks)
  private pendingQuantizedTimer: ReturnType<typeof setTimeout> | null = null;
  private activeSpinbackTimers: Array<ReturnType<typeof setTimeout>> = [];
  private activeEchoStutterTimer: ReturnType<typeof setInterval> | null = null;
  private activeFxNodes: Array<{ stop?: () => void; disconnect: () => void }> = [];

  // Dedicated Preview / Landing Demo channel
  private previewAudioElement: HTMLAudioElement | null = null;
  private previewSourceNode: MediaElementAudioSourceNode | null = null;
  private previewFilterNode: BiquadFilterNode | null = null;
  private previewGainNode: GainNode | null = null;
  private previewClipTimer: ReturnType<typeof setInterval> | null = null;
  private activePreviewOscillators: Array<{ stop?: () => void; disconnect: () => void }> = [];

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

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

      if (AudioCtx) {
        this.audioContext = new AudioCtx();

        // Master Gain
        this.masterGainNode = this.audioContext.createGain();
        this.masterGainNode.gain.value = this.masterGainValue;

        // Live FFT Analyser for visualizers
        this.analyserNode = this.audioContext.createAnalyser();
        this.analyserNode.fftSize = 128;
        this.analyserNode.smoothingTimeConstant = 0.78;

        // Master DynamicsCompressorNode Limiter (guards against FX & crossfade clipping)
        this.masterLimiterNode = this.audioContext.createDynamicsCompressor();
        this.masterLimiterNode.threshold.value = -3.0;
        this.masterLimiterNode.knee.value = 6.0;
        this.masterLimiterNode.ratio.value = 12.0;
        this.masterLimiterNode.attack.value = 0.002;
        this.masterLimiterNode.release.value = 0.15;

        // Routing: masterGain -> analyser -> masterLimiter -> destination
        this.masterGainNode.connect(this.analyserNode);
        this.analyserNode.connect(this.masterLimiterNode);
        this.masterLimiterNode.connect(this.audioContext.destination);

        this.deck1.attachWebAudio(this.audioContext, this.masterGainNode);
        this.deck2.attachWebAudio(this.audioContext, this.masterGainNode);
      }

      this.setCrossfader(0.0);
      this.isInitialized = true;
    } catch (e) {
      console.warn('Audio initialization note:', e);
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
      console.warn('Direct user gesture required to unpause audio:', e);
      return false;
    }
  }

  public getFrequencyData(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.analyserNode || !this.audioContext || this.audioContext.state !== 'running') {
      return false;
    }
    this.analyserNode.getByteFrequencyData(target);
    return true;
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
      const now = this.audioContext.currentTime;
      this.masterGainNode.gain.cancelScheduledValues(now);
      this.masterGainNode.gain.setTargetAtTime(muted ? 0.0 : this.masterGainValue, now, 0.01);
    }
    if (this.deck1) this.deck1.setMasterGain(this.masterGainValue, muted);
    if (this.deck2) this.deck2.setMasterGain(this.masterGainValue, muted);
  }

  public cancelPendingStarts() {
    if (this.pendingQuantizedTimer !== null) {
      clearTimeout(this.pendingQuantizedTimer);
      this.pendingQuantizedTimer = null;
    }
  }

  public quantizedStart(fromDeckNum: 1 | 2, toDeckNum: 1 | 2, masterBpm: number, cuePointSec: number = 0.07): number {
    this.ensureRunning();
    this.cancelPendingStarts();

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
      this.pendingQuantizedTimer = setTimeout(() => {
        this.pendingQuantizedTimer = null;
        try {
          toDeck.start();
        } catch (err) {
          console.warn('[audioEngine] Delayed start error:', err);
        }
      }, delayMs);
    }

    return delayMs;
  }

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

      if (Math.abs(diff) > 0.015 && toDeck.audioElement) {
        const nudge = Math.max(0.96, Math.min(1.04, 1.0 - diff * 0.4));
        toDeck.audioElement.playbackRate = toDeck.basePlaybackRate * nudge;
        setTimeout(() => {
          if (toDeck.audioElement) {
            toDeck.audioElement.playbackRate = toDeck.basePlaybackRate;
          }
        }, 70);
      }
    } catch {
      // Non-blocking phase lock error
    }
  }

  // -------------------------------------------------------------
  // Live DJ Club Hype Sound FX Generator (Routed via Master Limiter)
  // -------------------------------------------------------------
  public stopAllFx() {
    this.activeSpinbackTimers.forEach((t) => clearTimeout(t));
    this.activeSpinbackTimers = [];

    if (this.activeEchoStutterTimer !== null) {
      clearInterval(this.activeEchoStutterTimer);
      this.activeEchoStutterTimer = null;
    }

    this.activeFxNodes.forEach((node) => {
      try {
        node.stop?.();
        node.disconnect();
      } catch {
        // Ignore already stopped
      }
    });
    this.activeFxNodes = [];
  }

  public triggerAirhorn() {
    this.ensureRunning();
    if (!this.audioContext || !this.masterGainNode) return;
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const fxTarget = this.masterGainNode;

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

        gain.gain.setValueAtTime(0.16, now + pulseStart);
        gain.gain.exponentialRampToValueAtTime(0.001, now + pulseStart + dur);

        osc.connect(gain);
        gain.connect(fxTarget);
        osc.start(now + pulseStart);
        osc.stop(now + pulseStart + dur + 0.02);

        this.activeFxNodes.push(osc, gain);
        osc.onended = () => {
          try {
            osc.disconnect();
            gain.disconnect();
          } catch {
            // ignore
          }
        };
      });
    });
  }

  public triggerSpinback(deckNum: 1 | 2) {
    this.ensureRunning();
    this.activeSpinbackTimers.forEach((t) => clearTimeout(t));
    this.activeSpinbackTimers = [];

    const d = deckNum === 1 ? this.deck1 : this.deck2;
    if (d && d.audioElement) {
      const baseRate = d.basePlaybackRate || 1.0;
      d.audioElement.playbackRate = 2.0;
      this.activeSpinbackTimers.push(
        setTimeout(() => { if (d.audioElement) d.audioElement.playbackRate = 0.5; }, 120),
        setTimeout(() => { if (d.audioElement) d.audioElement.playbackRate = 0.25; }, 260),
        setTimeout(() => { if (d.audioElement) d.audioElement.playbackRate = baseRate; }, 480)
      );
    }

    if (this.audioContext && this.masterGainNode) {
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
      const ctx = this.audioContext;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.55);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.connect(gain);
      gain.connect(this.masterGainNode);
      osc.start(now);
      osc.stop(now + 0.65);

      this.activeFxNodes.push(osc, gain);
      osc.onended = () => {
        try {
          osc.disconnect();
          gain.disconnect();
        } catch {
          // ignore
        }
      };
    }
  }

  public triggerSubDrop() {
    this.ensureRunning();
    if (!this.audioContext || !this.masterGainNode) return;
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
    const ctx = this.audioContext;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + 0.9);

    gain.gain.setValueAtTime(0.75, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(gain);
    gain.connect(this.masterGainNode);
    osc.start(now);
    osc.stop(now + 1.25);

    this.activeFxNodes.push(osc, gain);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // ignore
      }
    };
  }

  public triggerEchoFreeze(deckNum: 1 | 2) {
    this.ensureRunning();
    if (this.activeEchoStutterTimer !== null) {
      clearInterval(this.activeEchoStutterTimer);
      this.activeEchoStutterTimer = null;
    }

    const d = deckNum === 1 ? this.deck1 : this.deck2;
    if (!d) return;

    if (d.hasWebAudioAttached && d.channelGainNode && this.audioContext) {
      const ctx = this.audioContext;
      const now = ctx.currentTime;
      const startGain = d.channelGainNode.gain.value || 1.0;
      d.channelGainNode.gain.cancelScheduledValues(now);

      for (let i = 0; i < 8; i++) {
        const t = now + i * 0.095;
        const val = i % 2 === 0 ? startGain * Math.pow(0.78, i) : 0.02;
        d.channelGainNode.gain.setValueAtTime(val, t);
      }
      d.channelGainNode.gain.setValueAtTime(startGain, now + 8 * 0.095);
    } else if (d.audioElement) {
      let count = 0;
      const vol = d.audioElement.volume;
      this.activeEchoStutterTimer = setInterval(() => {
        count++;
        d.audioElement.volume = count % 2 === 0 ? vol * Math.pow(0.75, count) : 0;
        if (count >= 8) {
          if (this.activeEchoStutterTimer !== null) {
            clearInterval(this.activeEchoStutterTimer);
            this.activeEchoStutterTimer = null;
          }
          d.audioElement.volume = vol;
        }
      }, 95);
    }
  }

  // -------------------------------------------------------------
  // Landing Page Preview & Demo Audio Channel (Shared Singleton)
  // -------------------------------------------------------------
  public stopAllPreviews() {
    if (this.previewClipTimer !== null) {
      clearInterval(this.previewClipTimer);
      this.previewClipTimer = null;
    }

    this.activePreviewOscillators.forEach((n) => {
      try {
        n.stop?.();
        n.disconnect();
      } catch {
        // ignore
      }
    });
    this.activePreviewOscillators = [];

    if (this.previewGainNode && this.audioContext) {
      try {
        this.previewGainNode.gain.cancelScheduledValues(this.audioContext.currentTime);
      } catch {
        // ignore
      }
    }

    if (this.previewAudioElement) {
      this.previewAudioElement.pause();
      this.previewAudioElement.currentTime = 0;
    }
  }

  public async playModulePreview(soundType: string): Promise<void> {
    await this.unlockAllAudio();
    this.stopAllPreviews();

    if (!this.audioContext || !this.masterGainNode) return;

    if (soundType === 'airhorn') {
      this.triggerAirhorn();
      return;
    }
    if (soundType === 'bass') {
      this.triggerSubDrop();
      return;
    }

    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = soundType === 'phrase' ? 'sine' : 'triangle';
    const freq = soundType === 'phrase' ? 440 : soundType === 'harmonic' ? 523.25 : 659.25;
    osc.frequency.setValueAtTime(freq, now);
    if (soundType === 'phrase') {
      osc.frequency.setValueAtTime(554.37, now + 0.14);
    }

    gain.gain.setValueAtTime(0.16, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.masterGainNode);
    osc.start(now);
    osc.stop(now + 0.36);

    this.activePreviewOscillators.push(osc, gain);
    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {
        // ignore
      }
    };
  }

  public async playDemoClip(
    src: string,
    startSec: number,
    mode: 'mixmind' | 'spotify',
    onProgress: (progressPct: number, timeStr: string) => void,
    onEnded: () => void
  ): Promise<boolean> {
    await this.unlockAllAudio();
    this.stopAllPreviews();

    try {
      if (!this.previewAudioElement) {
        this.previewAudioElement = new Audio();
        this.previewAudioElement.crossOrigin = 'anonymous';
        this.previewAudioElement.preload = 'auto';
      }

      if (this.audioContext && this.masterGainNode && !this.previewSourceNode) {
        this.previewSourceNode = this.audioContext.createMediaElementSource(this.previewAudioElement);
        this.previewFilterNode = this.audioContext.createBiquadFilter();
        this.previewFilterNode.type = 'lowshelf';
        this.previewFilterNode.frequency.value = 220;
        this.previewFilterNode.gain.value = 0;

        this.previewGainNode = this.audioContext.createGain();
        this.previewGainNode.gain.value = 1.0;

        this.previewSourceNode.connect(this.previewFilterNode);
        this.previewFilterNode.connect(this.previewGainNode);
        this.previewGainNode.connect(this.masterGainNode);
      }

      if (!this.previewAudioElement.src.endsWith(src)) {
        this.previewAudioElement.src = src;
        this.previewAudioElement.load();
      }
      this.previewAudioElement.currentTime = startSec;

      if (this.previewFilterNode && this.previewGainNode && this.audioContext) {
        const now = this.audioContext.currentTime;
        this.previewGainNode.gain.cancelScheduledValues(now);
        this.previewFilterNode.gain.cancelScheduledValues(now);

        if (mode === 'mixmind') {
          this.previewFilterNode.gain.setTargetAtTime(3.0, now, 0.03);
          this.previewGainNode.gain.setTargetAtTime(1.0, now, 0.03);
        } else {
          this.previewFilterNode.gain.setTargetAtTime(-8.0, now, 0.03);
          this.previewGainNode.gain.setTargetAtTime(0.65, now, 0.03);
        }
      }

      await this.previewAudioElement.play();

      const clipStart = Date.now();
      const clipDuration = 15000;

      this.previewClipTimer = setInterval(() => {
        const elapsed = Date.now() - clipStart;
        const p = Math.min(100, (elapsed / clipDuration) * 100);
        const secs = Math.floor(elapsed / 1000);
        onProgress(p, `0:${secs < 10 ? '0' : ''}${secs}`);

        // Simulate Standard Fade mid-transition volume dip cleanly in Web Audio
        if (mode === 'spotify' && this.previewGainNode && this.audioContext) {
          const target = elapsed > 4000 && elapsed < 10000 ? 0.32 : 0.65;
          this.previewGainNode.gain.setTargetAtTime(target, this.audioContext.currentTime, 0.08);
        }

        if (elapsed >= clipDuration) {
          this.stopAllPreviews();
          onEnded();
        }
      }, 50);

      return true;
    } catch {
      this.stopAllPreviews();
      return false;
    }
  }
}

export const audioEngine = MasterAudioEngine.getInstance();
