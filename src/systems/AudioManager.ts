export enum SoundEffect {
  Coin = 'coin',
  Jump = 'jump',
  Slide = 'slide',
  LaneChange = 'lane-change',
  PowerUp = 'power-up',
  ShieldBreak = 'shield-break',
  HoverDeviceBreak = 'hover-device-break',
  Collision = 'collision',
  Button = 'button',
  GameOver = 'game-over',
  LevelUp = 'level-up',
}

export interface AudioManagerConfig {
  masterVolume: number;
  musicVolume: number;
  soundEffectVolume: number;
  muted: boolean;
}

export const DEFAULT_AUDIO_CONFIG: Readonly<AudioManagerConfig> = {
  masterVolume: 0.72,
  musicVolume: 0.32,
  soundEffectVolume: 0.72,
  muted: false,
};

type AudioContextConstructor = new (contextOptions?: AudioContextOptions) => AudioContext;
type AudioWindow = Window & {
  AudioContext?: AudioContextConstructor;
  webkitAudioContext?: AudioContextConstructor;
};

function clampVolume(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

export class AudioManager {
  public readonly config: AudioManagerConfig;

  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private readonly musicSources: AudioScheduledSourceNode[] = [];
  private musicOutput: GainNode | null = null;
  private musicRequested = false;
  private unlockTarget: EventTarget | null = null;
  private disposed = false;

  public constructor(config: Partial<AudioManagerConfig> = {}) {
    this.config = { ...DEFAULT_AUDIO_CONFIG, ...config };
  }

  public get ready(): boolean {
    return this.context?.state === 'running';
  }

  public get supported(): boolean {
    if (typeof window === 'undefined') return false;
    const audioWindow = window as AudioWindow;
    return audioWindow.AudioContext !== undefined || audioWindow.webkitAudioContext !== undefined;
  }

  /** Call from a click/tap handler. Safe to call repeatedly. */
  public async unlock(): Promise<boolean> {
    if (this.disposed || !this.initialize()) return false;
    const context = this.context;
    if (context === null) return false;
    try {
      if (context.state === 'suspended') await context.resume();
      const unlocked = context.state === 'running';
      if (unlocked) {
        this.unbindAutoUnlock();
        if (this.musicRequested && this.musicSources.length === 0) this.startMusicNodes();
      }
      return unlocked;
    } catch {
      return false;
    }
  }

  public bindAutoUnlock(target: EventTarget = document): void {
    if (this.disposed || this.unlockTarget === target) return;
    this.unbindAutoUnlock();
    this.unlockTarget = target;
    target.addEventListener('pointerdown', this.onUnlockGesture, { once: true });
    target.addEventListener('keydown', this.onUnlockGesture, { once: true });
  }

  public play(effect: SoundEffect): boolean {
    if (this.disposed || this.config.muted || !this.initialize()) return false;
    if (this.context?.state !== 'running') {
      void this.unlock();
      return false;
    }
    switch (effect) {
      case SoundEffect.Coin:
        this.tone(880, 0.075, 'sine', 0.2, 1320);
        this.tone(1320, 0.09, 'sine', 0.12, 1760, 0.045);
        break;
      case SoundEffect.Jump:
        this.tone(240, 0.2, 'triangle', 0.24, 610);
        break;
      case SoundEffect.Slide:
        this.noise(0.18, 0.18, 1200, 160);
        break;
      case SoundEffect.LaneChange:
        this.tone(330, 0.075, 'sine', 0.09, 420);
        break;
      case SoundEffect.PowerUp:
        this.tone(330, 0.24, 'triangle', 0.18, 990);
        this.tone(660, 0.22, 'sine', 0.12, 1320, 0.08);
        break;
      case SoundEffect.ShieldBreak:
        this.noise(0.32, 0.32, 4200, 850);
        this.tone(740, 0.3, 'sine', 0.14, 160);
        break;
      case SoundEffect.HoverDeviceBreak:
        this.noise(0.38, 0.28, 2600, 220);
        this.tone(320, 0.36, 'sawtooth', 0.12, 70);
        break;
      case SoundEffect.Collision:
        this.noise(0.42, 0.4, 900, 80);
        this.tone(115, 0.34, 'square', 0.16, 42);
        break;
      case SoundEffect.Button:
        this.tone(520, 0.055, 'sine', 0.1, 640);
        break;
      case SoundEffect.GameOver:
        this.tone(330, 0.65, 'triangle', 0.18, 82);
        this.tone(220, 0.58, 'sine', 0.12, 55, 0.12);
        break;
      case SoundEffect.LevelUp:
        this.tone(440, 0.22, 'triangle', 0.17, 660);
        this.tone(660, 0.24, 'triangle', 0.15, 990, 0.13);
        this.tone(990, 0.35, 'sine', 0.12, 1320, 0.26);
        break;
    }
    return true;
  }

  public startMusic(): void {
    this.musicRequested = true;
    if (!this.initialize() || this.context?.state !== 'running' || this.musicSources.length > 0)
      return;
    this.startMusicNodes();
  }

  public stopMusic(): void {
    this.musicRequested = false;
    for (const source of this.musicSources) {
      try {
        source.stop();
      } catch {
        // A source can already have ended during tab suspension.
      }
      source.disconnect();
    }
    this.musicSources.length = 0;
    this.musicOutput?.disconnect();
    this.musicOutput = null;
  }

  public setMasterVolume(volume: number): void {
    this.config.masterVolume = clampVolume(volume);
    this.applyVolumes();
  }

  public setMusicVolume(volume: number): void {
    this.config.musicVolume = clampVolume(volume);
    this.applyVolumes();
  }

  public setSoundEffectVolume(volume: number): void {
    this.config.soundEffectVolume = clampVolume(volume);
    this.applyVolumes();
  }

  public setMuted(muted: boolean): void {
    this.config.muted = muted;
    this.applyVolumes();
  }

  public async suspend(): Promise<void> {
    if (this.context?.state === 'running') await this.context.suspend();
  }

  public async resume(): Promise<boolean> {
    return this.unlock();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.stopMusic();
    this.disposed = true;
    this.unbindAutoUnlock();
    this.masterGain?.disconnect();
    this.musicGain?.disconnect();
    this.effectsGain?.disconnect();
    if (this.context !== null && this.context.state !== 'closed') void this.context.close();
    this.context = null;
    this.masterGain = null;
    this.musicGain = null;
    this.effectsGain = null;
    this.noiseBuffer = null;
  }

  private initialize(): boolean {
    if (this.context !== null) return true;
    if (!this.supported) return false;
    try {
      const audioWindow = window as AudioWindow;
      const Context = audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
      if (Context === undefined) return false;
      const context = new Context({ latencyHint: 'interactive' });
      const masterGain = context.createGain();
      const musicGain = context.createGain();
      const effectsGain = context.createGain();
      musicGain.connect(masterGain);
      effectsGain.connect(masterGain);
      masterGain.connect(context.destination);
      this.context = context;
      this.masterGain = masterGain;
      this.musicGain = musicGain;
      this.effectsGain = effectsGain;
      this.applyVolumes();
      return true;
    } catch {
      this.context = null;
      return false;
    }
  }

  private applyVolumes(): void {
    const now = this.context?.currentTime ?? 0;
    const muteScale = this.config.muted ? 0 : 1;
    this.masterGain?.gain.setTargetAtTime(
      clampVolume(this.config.masterVolume) * muteScale,
      now,
      0.015,
    );
    this.musicGain?.gain.setTargetAtTime(clampVolume(this.config.musicVolume), now, 0.02);
    this.effectsGain?.gain.setTargetAtTime(clampVolume(this.config.soundEffectVolume), now, 0.015);
  }

  private tone(
    startFrequency: number,
    duration: number,
    wave: OscillatorType,
    volume: number,
    endFrequency = startFrequency,
    delay = 0,
  ): void {
    const context = this.context;
    const destination = this.effectsGain;
    if (context === null || destination === null) return;
    const start = context.currentTime + delay;
    const end = start + Math.max(0.02, duration);
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(Math.max(20, startFrequency), start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), end);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume), start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.start(start);
    oscillator.stop(end + 0.015);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  }

  private noise(
    duration: number,
    volume: number,
    startFrequency: number,
    endFrequency: number,
  ): void {
    const context = this.context;
    const destination = this.effectsGain;
    if (context === null || destination === null) return;
    if (this.noiseBuffer === null) this.noiseBuffer = this.createNoiseBuffer(context);
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const envelope = context.createGain();
    const start = context.currentTime;
    const end = start + Math.max(0.03, duration);
    source.buffer = this.noiseBuffer;
    filter.type = 'bandpass';
    filter.Q.value = 0.72;
    filter.frequency.setValueAtTime(Math.max(30, startFrequency), start);
    filter.frequency.exponentialRampToValueAtTime(Math.max(30, endFrequency), end);
    envelope.gain.setValueAtTime(Math.max(0.0001, volume), start);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(destination);
    source.start(start);
    source.stop(end);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const length = Math.floor(context.sampleRate * 0.5);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < length; index += 1) {
      const white = Math.random() * 2 - 1;
      previous = previous * 0.82 + white * 0.18;
      samples[index] = previous;
    }
    return buffer;
  }

  private startMusicNodes(): void {
    const context = this.context;
    const destination = this.musicGain;
    if (context === null || destination === null || context.state !== 'running') return;
    const output = context.createGain();
    const filter = context.createBiquadFilter();
    output.gain.value = 0.15;
    filter.type = 'lowpass';
    filter.frequency.value = 1100;
    filter.Q.value = 0.65;
    output.connect(filter);
    filter.connect(destination);

    const frequencies = [110, 164.81, 220];
    frequencies.forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 0 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      oscillator.detune.value = index * 3 - 2;
      gain.gain.value = index === 0 ? 0.42 : 0.2;
      oscillator.connect(gain);
      gain.connect(output);
      oscillator.start();
      this.musicSources.push(oscillator);
    });

    const lfo = context.createOscillator();
    const lfoDepth = context.createGain();
    lfo.frequency.value = 0.22;
    lfoDepth.gain.value = 0.055;
    lfo.connect(lfoDepth);
    lfoDepth.connect(output.gain);
    lfo.start();
    this.musicSources.push(lfo);
    this.musicOutput = output;
  }

  private readonly onUnlockGesture = (): void => {
    void this.unlock();
  };

  private unbindAutoUnlock(): void {
    if (this.unlockTarget === null) return;
    this.unlockTarget.removeEventListener('pointerdown', this.onUnlockGesture);
    this.unlockTarget.removeEventListener('keydown', this.onUnlockGesture);
    this.unlockTarget = null;
  }
}
