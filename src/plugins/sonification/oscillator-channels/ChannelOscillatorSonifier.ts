/**
 * ChannelOscillatorSonifier: Web Audio oscillators whose pitch, volume and effects are each
 * driven by a channel of the sample the user chooses.
 *
 * Why: layered images carry more than colour; the user decides which channel (hue, a FITS
 * layer, …) is heard as pitch, which as volume and which through each of its effects.
 * What: same lifecycle and audio routing as the classic oscillator; processSamples() reads
 * the bound channels, normalises them with the channel ranges the sampler published, and
 * sets frequency, gain and the per-voice effects, chained in series.
 * How: where a bound channel has no data, its binding's `noData` decides: "silence" stops
 * the voice, "pulse" keeps it playing (missing pitch/volume at mid-range, effect neutral)
 * but pulses its loudness, "proximity" pulses faster the closer the nearest data is (from
 * the channel's distance value, within `proximityReach`), "neutral" plays the
 * mid-range/neutral setting as if it were data.
 * Invert flips a channel's 0–1 value. The sonifier adds a "handSpeed" channel from the
 * point's motion, and `soundMode` ties each voice to motion (see shared/motionGate.ts).
 */

import {
  type ErrorOr,
  hsvSampleChannels,
  type ImageSample,
  type SampleChannel,
  type Sonifier,
  type SonifierOptions,
} from "#src/core/interfaces";
import {
  MotionTracker,
  type RestBehavior,
  samplePosition,
} from "#src/plugins/sonification/shared/motion";
import {
  createMotionGate,
  type MotionGate,
  type SoundMode,
} from "#src/plugins/sonification/shared/motionGate";
import {
  type SinkableAudioContext,
  SinkOutputRouter,
} from "#src/plugins/sonification/shared/SinkOutputRouter";
import {
  createNoDataPulse,
  createVoiceEffect,
  NO_DATA_PULSE_HZ,
  type NoDataPulse,
  proximityPulseRate,
  type VoiceEffect,
  type VoiceEffectKind,
} from "#src/plugins/sonification/shared/voiceEffects";

/** What a voice does where its channel has no data. */
export type NoDataBehavior = "silence" | "pulse" | "proximity" | "neutral";

/** A sound property's source: a channel key (null = none), whether to flip it, and no-data handling. */
export type ChannelBinding = { channel: string | null; invert: boolean; noData: NoDataBehavior };

export type ChannelOscillatorSonifierOptions = SonifierOptions & {
  pitchBinding?: ChannelBinding;
  volumeBinding?: ChannelBinding;
  /** Effects, each driven by its own channel, applied in this order. */
  effects?: readonly EffectSlot[];
  /** Channel ranges, as published by the sampler. */
  channels?: readonly SampleChannel[];
  /** Distance (fraction of the image's longer side) at which proximity pulsing starts. */
  proximityReach?: number;
  /** How motion shapes the sound: only while moving, plucked, or continuous. */
  soundMode?: SoundMode;
  /** What to play when the hand rests in one spot. */
  restBehavior?: RestBehavior;
  minFreq?: number;
  maxFreq?: number;
  minVol?: number;
  maxVol?: number;
  fadeMs?: number;
  masterVolume?: number;
  muted?: boolean;
  sinkId?: string;
};

type ToneNodes = {
  osc: OscillatorNode;
  gain: GainNode;
  pulse: NoDataPulse;
  /** One per effect slot, in order. */
  effects: VoiceEffect[];
  /** Pass-through nodes between consecutive effects. */
  links: GainNode[];
  gate: MotionGate;
};

/** An effect driven by a channel: its type and how strongly it can act (0–1). */
export type EffectSlot = { binding: ChannelBinding; kind: VoiceEffectKind; amount: number };

/**
 * Channel this sonifier adds to every sample with a position: the point's speed, in canvas
 * heights per second (1 is a fast sweep).
 */
export const handSpeedChannel: SampleChannel = {
  key: "handSpeed",
  label: "Hand speed",
  min: 0,
  max: 1,
};

/** A binding's value for one sample: 0–1 or null for "neutral", plus a pulse rate; or silent. */
type Resolved = { silent: true } | { silent: false; value: number | null; pulseHz: number | null };

export type ChannelOscillatorAnalyserOptions = {
  fftSize?: number;
  smoothingTimeConstant?: number;
};

export type DebugFrameSample = {
  frequency: number;
  volume: number;
  hueByte: number;
  saturationByte: number;
  valueByte: number;
};

const findNumber = (source: Record<string, number>, key: string | null): number | null => {
  if (!key) return null;
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
};

export class ChannelOscillatorSonifier implements Sonifier {
  private ctx: AudioContext | null;
  private nodes = new Map<string, ToneNodes>();
  private sinkRouter: SinkOutputRouter | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private oscillatorType: OscillatorType = "sine";
  private minFreq = 200;
  private maxFreq = 700;
  private minVol = 0;
  private maxVol = 0.2;
  private masterVolume = 1;
  private muted = false;
  private sinkId = "";
  private fadeMs = 100;
  private pitch: ChannelBinding = { channel: "hueByte", invert: false, noData: "silence" };
  private volume: ChannelBinding = { channel: "valueByte", invert: false, noData: "silence" };
  private effects: EffectSlot[] = [];
  private proximityReach = 0.15;
  private soundMode: SoundMode = "continuous";
  private motion = new MotionTracker();
  private channelRanges = new Map<string, SampleChannel>(
    [...hsvSampleChannels, handSpeedChannel].map((channel) => [channel.key, channel]),
  );
  private initialized = false;
  private stopped = false;
  private lastFrameDebug = new Map<string, DebugFrameSample>();

  constructor(ctx?: AudioContext, options: ChannelOscillatorSonifierOptions = {}) {
    this.ctx = ctx ?? null;
    this.configure(options);
  }

  async initialize(): Promise<ErrorOr<undefined>> {
    if (this.initialized) return;

    if (!this.ctx) {
      const NativeAudioContext =
        typeof window !== "undefined"
          ? window.AudioContext ||
            (window as typeof window & { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext
          : undefined;

      if (!NativeAudioContext) {
        return new Error("Web Audio API is not available in this environment.");
      }

      this.ctx = new NativeAudioContext();
    }

    // Try to resume AudioContext if suspended, but don't block initialization
    // The context will resume automatically after the first user gesture
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {
        // Resume will fail until user interaction - this is expected
      });

      // Add one-time listeners for any user interaction to resume audio
      // These will auto-remove after first trigger due to { once: true }
      const resumeOnInteraction = () => {
        if (this.ctx && this.ctx.state === "suspended") {
          void this.ctx.resume();
        }
      };

      document.addEventListener("click", resumeOnInteraction, { once: true, capture: true });
      document.addEventListener("keydown", resumeOnInteraction, { once: true, capture: true });
      document.addEventListener("touchstart", resumeOnInteraction, {
        once: true,
        capture: true,
      });
    }

    if (this.sinkId) {
      await this.setOutputSinkId(this.sinkId);
    }

    this.initialized = true;
  }

  configure(options: ChannelOscillatorSonifierOptions): void {
    if (options.oscillatorType) {
      this.oscillatorType = options.oscillatorType;
      // Update existing oscillators immediately to keep tone character consistent.
      for (const { osc } of this.nodes.values()) {
        osc.type = this.oscillatorType;
      }
    }

    if (options.minFreq !== undefined) this.minFreq = options.minFreq;
    if (options.maxFreq !== undefined) this.maxFreq = options.maxFreq;
    if (options.minVol !== undefined) this.minVol = options.minVol;
    if (options.maxVol !== undefined) this.maxVol = options.maxVol;
    if (options.fadeMs !== undefined) this.fadeMs = options.fadeMs;
    if (options.pitchBinding) this.pitch = options.pitchBinding;
    if (options.volumeBinding) this.volume = options.volumeBinding;
    if (options.effects) {
      const wiring = this.effects.map((slot) => slot.kind).join();
      this.effects = options.effects
        .filter((slot) => slot.binding.channel !== null && slot.kind !== "none")
        .map((slot) => ({ ...slot, amount: Math.max(0, Math.min(1, slot.amount)) }));
      if (this.effects.map((slot) => slot.kind).join() !== wiring) {
        // Voices are wired for a set of effects: fade them out; the next frame rebuilds them.
        this.stopAll();
      }
    }
    if (options.soundMode !== undefined) this.soundMode = options.soundMode;
    if (options.restBehavior !== undefined) this.motion.configure({ rest: options.restBehavior });
    if (options.proximityReach !== undefined && options.proximityReach > 0) {
      this.proximityReach = options.proximityReach;
    }
    if (options.channels) {
      this.channelRanges = new Map(
        [...hsvSampleChannels, ...options.channels, handSpeedChannel].map((channel) => [
          channel.key,
          channel,
        ]),
      );
    }
    if (options.masterVolume !== undefined) {
      this.masterVolume = Math.max(0, Math.min(1, options.masterVolume));
    }
    if (options.muted !== undefined) this.muted = options.muted;
    if (options.sinkId !== undefined) {
      this.sinkId = options.sinkId;
      void this.setOutputSinkId(options.sinkId);
    }
    if (options.volume !== undefined) {
      // Keep backward compatibility with SonifierOptions.volume as master gain.
      this.maxVol = options.volume;
    }

    this.applyMasterGain();
  }

  processSamples(samples: Map<string, ImageSample>): ErrorOr<undefined> {
    if (!this.ctx) {
      return new Error("ChannelOscillatorSonifier must be initialized before processing samples.");
    }

    if (this.stopped) {
      return; // Ignore samples after stop() has been called
    }

    // Resume AudioContext if it gets suspended (e.g., after tab backgrounding or initial load)
    // This will succeed after the first user gesture (click, tap, keypress)
    if (this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {
        // Resume will fail until user interaction - this is expected
      });
    }

    const seen = new Set<string>();
    const frameDebug = new Map<string, DebugFrameSample>();

    for (const [id, sample] of samples) {
      const position = samplePosition(sample);
      const motion = position
        ? this.motion.update(id, position.x, position.y, performance.now())
        : null;
      if (motion) sample.data[handSpeedChannel.key] = motion.speed;

      const pitch = this.resolve(sample.data, this.pitch, 0.5);
      const loudness = this.resolve(sample.data, this.volume, 0.5);
      const effects = this.effects.map((slot) => this.resolve(sample.data, slot.binding, null));
      if (pitch.silent || loudness.silent || effects.some((effect) => effect.silent)) {
        continue; // No data here and the binding asks for silence.
      }

      const frequency = this.minFreq + (pitch.value ?? 0.5) * (this.maxFreq - this.minFreq);
      const volume = this.minVol + (loudness.value ?? 0.5) * (this.maxVol - this.minVol);
      // Several missing channels: the fastest pulse wins (it is the most informative).
      const rates = [pitch, loudness, ...effects]
        .map((resolved) => (resolved.silent ? null : resolved.pulseHz))
        .filter((rate): rate is number => rate !== null);
      const pulse = rates.length > 0 ? Math.max(...rates) : null;

      frameDebug.set(id, {
        frequency,
        volume,
        hueByte: findNumber(sample.data, "hueByte") ?? 0,
        saturationByte: findNumber(sample.data, "saturationByte") ?? 0,
        valueByte: findNumber(sample.data, "valueByte") ?? 0,
      });

      const effectValues = effects.map((effect) => (effect.silent ? null : effect.value));
      this.updateTone(id, frequency, volume, effectValues, pulse);
      this.nodes.get(id)?.gate.apply(this.soundMode, motion, this.ctx.currentTime);
      seen.add(id);
    }

    this.lastFrameDebug = frameDebug;
    this.motion.retain(new Set(samples.keys()));

    // Stop any tones that were not present in this frame
    for (const id of Array.from(this.nodes.keys())) {
      if (!seen.has(id)) {
        this.stopTone(id);
      }
    }
  }

  stop(): void {
    this.stopped = true;
    this.motion.clear();
    this.stopAll();
    this.sinkRouter?.dispose();
    this.sinkRouter = null;
  }

  getLastFrameDebug(): Map<string, DebugFrameSample> {
    return this.lastFrameDebug;
  }

  /**
   * Returns an AnalyserNode that taps the sonifier output (no mic required).
   *
   * Why: visualizers (e.g., a reactive logo) need spectrum/waveform data from the
   * audio we generate, without reaching inside individual tone nodes.
   * What: this lazily creates a single AnalyserNode and routes all tone gains
   * through it, then connects it to `ctx.destination`.
   * How: we switch the internal output node and reconnect any existing tones.
   */
  getAnalyserNode(options: ChannelOscillatorAnalyserOptions = {}): AnalyserNode | null {
    if (!this.ctx) return null;
    const ctx = this.ctx;

    if (!this.analyser) {
      this.analyser = ctx.createAnalyser();
      this.analyser.connect(ctx.destination);
    }

    if (options.fftSize !== undefined) {
      this.analyser.fftSize = options.fftSize;
    }
    if (options.smoothingTimeConstant !== undefined) {
      this.analyser.smoothingTimeConstant = options.smoothingTimeConstant;
    }

    this.ensureSinkRouter().setOutputNode(this.analyser);

    return this.analyser;
  }

  async setOutputSinkId(sinkId: string): Promise<boolean> {
    this.sinkId = sinkId;
    if (!this.ctx) return false;

    const router = this.ensureSinkRouter();
    const changed = await router.setSinkId(sinkId);
    if (changed) {
      this.sinkId = router.getCurrentSinkId();
      return true;
    }

    const sinkableCtx = this.ctx as SinkableAudioContext;
    if (sinkableCtx.state === "closed") {
      this.ctx = null;
      this.nodes.clear();
      this.masterGain = null;
      this.sinkRouter = null;
      this.analyser = null;
    }
    return false;
  }

  /** A bound channel's value scaled to 0–1 (inverted if asked), or null without data. */
  private read(data: Record<string, number>, binding: ChannelBinding): number | null {
    const raw = findNumber(data, binding.channel);
    if (raw === null || !binding.channel) return null;
    const range = this.channelRanges.get(binding.channel);
    const min = range?.min ?? 0;
    const max = range?.max ?? 1;
    const t = max === min ? 0 : Math.max(0, Math.min(1, (raw - min) / (max - min)));
    return binding.invert ? 1 - t : t;
  }

  /** Value of a binding for a sample, applying its no-data behaviour when the channel is missing. */
  private resolve(
    data: Record<string, number>,
    binding: ChannelBinding,
    neutral: number | null,
  ): Resolved {
    const value = this.read(data, binding);
    if (value !== null) return { silent: false, value, pulseHz: null };
    switch (binding.noData) {
      case "silence":
        return { silent: true };
      case "neutral":
        return { silent: false, value: neutral, pulseHz: null };
      case "proximity":
        return { silent: false, value: neutral, pulseHz: this.proximityRate(data, binding) };
      default:
        return { silent: false, value: neutral, pulseHz: NO_DATA_PULSE_HZ };
    }
  }

  /** Pulse rate from the distance to the nearest data; the plain rate without a distance. */
  private proximityRate(data: Record<string, number>, binding: ChannelBinding): number {
    const key = binding.channel ? this.channelRanges.get(binding.channel)?.distanceKey : undefined;
    const distance = key ? findNumber(data, key) : null;
    if (distance === null) return NO_DATA_PULSE_HZ;
    return proximityPulseRate(1 - distance / this.proximityReach);
  }

  private updateTone(
    id: string,
    frequency: number,
    volume: number,
    effects: readonly (number | null)[],
    pulse: number | null,
  ): void {
    const ctx = this.ensureContext();
    const nodes = this.nodes.get(id) ?? this.createTone(id);

    nodes.osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    nodes.gain.gain.setValueAtTime(volume, ctx.currentTime);
    nodes.pulse.set(pulse, ctx.currentTime);
    nodes.effects.forEach((effect, index) => {
      effect.apply(effects[index] ?? null, this.effects[index]?.amount ?? 0, ctx.currentTime);
    });
  }

  private createTone(id: string): ToneNodes {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = this.oscillatorType;
    osc.connect(gain);
    const pulse = createNoDataPulse(ctx);
    gain.connect(pulse.node);
    const gate = createMotionGate(ctx, this.soundMode);
    pulse.node.connect(gate.node);
    // Effects in series: gate → effect 1 → link → effect 2 → … → master.
    const master = this.ensureMasterGain();
    const effects: VoiceEffect[] = [];
    const links: GainNode[] = [];
    let input: AudioNode = gate.node;
    this.effects.forEach((slot, index) => {
      const isLast = index === this.effects.length - 1;
      const output = isLast ? master : ctx.createGain();
      if (!isLast) links.push(output as GainNode);
      effects.push(createVoiceEffect(ctx, slot.kind, osc, input, output));
      input = output;
    });
    if (this.effects.length === 0) gate.node.connect(master);
    osc.start();

    const toneNodes: ToneNodes = { osc, gain, pulse, effects, links, gate };
    this.nodes.set(id, toneNodes);
    return toneNodes;
  }

  private stopTone(id: string): void {
    const tone = this.nodes.get(id);
    const ctx = this.ctx;
    if (!tone || !ctx) return;

    // Remove from map immediately to prevent race conditions
    // If a new tone with same ID is created during fade, it won't conflict
    this.nodes.delete(id);

    const { gain, osc, pulse, effects, links, gate } = tone;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + this.fadeMs / 1000);

    setTimeout(() => {
      osc.stop();
      osc.disconnect();
      gain.disconnect();
      pulse.dispose();
      gate.dispose();
      for (const effect of effects) effect.dispose();
      for (const link of links) link.disconnect();
    }, this.fadeMs);
  }

  private stopAll(): void {
    for (const id of Array.from(this.nodes.keys())) {
      this.stopTone(id);
    }
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      throw new Error("ChannelOscillatorSonifier must be initialized before processing samples.");
    }
    this.ensureSinkRouter();
    this.ensureMasterGain();
    return this.ctx;
  }

  private ensureMasterGain(): GainNode {
    const ctx = this.ensureContextWithoutMasterGain();
    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.connect(this.ensureSinkRouter().getInputNode());
      this.applyMasterGain();
    }
    return this.masterGain;
  }

  private ensureContextWithoutMasterGain(): AudioContext {
    if (!this.ctx) {
      throw new Error("ChannelOscillatorSonifier must be initialized before processing samples.");
    }
    return this.ctx;
  }

  private ensureSinkRouter(): SinkOutputRouter {
    const ctx = this.ensureContextWithoutMasterGain() as SinkableAudioContext;
    if (!this.sinkRouter || this.sinkRouter.getContext() !== ctx) {
      this.sinkRouter?.dispose();
      this.sinkRouter = new SinkOutputRouter(ctx);
      this.sinkRouter.setOutputNode(this.analyser ?? ctx.destination);
      if (this.masterGain) {
        try {
          this.masterGain.disconnect();
        } catch {
          // ignore - node may already be disconnected
        }
        this.masterGain.connect(this.sinkRouter.getInputNode());
      }
    }
    return this.sinkRouter;
  }

  private applyMasterGain(): void {
    if (!this.masterGain || !this.ctx) return;
    const nextGain = this.muted ? 0 : this.masterVolume;
    this.masterGain.gain.setValueAtTime(nextGain, this.ctx.currentTime);
  }
}
