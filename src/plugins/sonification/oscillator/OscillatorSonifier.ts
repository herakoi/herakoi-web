/**
 * OscillatorSonifier implements the core Sonifier interface using Web Audio oscillators.
 *
 * Why: We want a plug-in sonifier that maps flexible ImageSample data into audible tones
 * without the controller knowing any audio details. This mirrors the legacy behavior but
 * fits the new interface-driven architecture.
 * What: initialize() prepares an AudioContext, processSamples() turns Map<id, ImageSample>
 * into oscillator/gain updates, and stop() fades and cleans up everything. configure()
 * lets us tune min/max frequency, volume range, waveform, and fade time at runtime.
 * How: We cache nodes per point id, translate hue/value bytes to frequency/volume, and
 * stop any nodes missing from the latest frame with a short fade-out.
 */

import type { ErrorOr, ImageSample, Sonifier, SonifierOptions } from "#src/core/interfaces";

export type OscillatorSonifierOptions = SonifierOptions & {
  minFreq?: number;
  maxFreq?: number;
  minVol?: number;
  maxVol?: number;
  fadeMs?: number;
};

type ToneNodes = {
  osc: OscillatorNode;
  gain: GainNode;
};

export type OscillatorSonifierAnalyserOptions = {
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

export class OscillatorSonifier implements Sonifier {
  private ctx: AudioContext | null;
  private nodes = new Map<string, ToneNodes>();
  private output: AudioNode | null = null;
  private analyser: AnalyserNode | null = null;
  private oscillatorType: OscillatorType = "sine";
  private minFreq = 200;
  private maxFreq = 700;
  private minVol = 0;
  private maxVol = 0.2;
  private fadeMs = 100;
  private initialized = false;
  private stopped = false;
  private lastFrameDebug = new Map<string, DebugFrameSample>();

  constructor(ctx?: AudioContext, options: OscillatorSonifierOptions = {}) {
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

    this.initialized = true;
  }

  configure(options: OscillatorSonifierOptions): void {
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
    if (options.volume !== undefined) {
      // Keep backward compatibility with SonifierOptions.volume as master gain.
      this.maxVol = options.volume;
    }
  }

  processSamples(samples: Map<string, ImageSample>): ErrorOr<undefined> {
    if (!this.ctx) {
      return new Error("OscillatorSonifier must be initialized before processing samples.");
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
      const hueByte = this.pickNumber(sample.data, ["hueByte", "hue", "h"]);
      const valueByte = this.pickNumber(sample.data, ["valueByte", "value", "v", "brightness"]);

      if (hueByte === null || valueByte === null) {
        continue; // Skip samples missing required fields
      }

      const saturationByte = this.pickNumber(sample.data, ["saturationByte", "saturation", "s"]);
      const frequency = this.scale(hueByte, this.minFreq, this.maxFreq);
      const volume = this.scale(valueByte, this.minVol, this.maxVol);

      frameDebug.set(id, {
        frequency,
        volume,
        hueByte,
        saturationByte: saturationByte ?? 0,
        valueByte,
      });

      this.updateTone(id, frequency, volume);
      seen.add(id);
    }

    this.lastFrameDebug = frameDebug;

    // Stop any tones that were not present in this frame
    for (const id of Array.from(this.nodes.keys())) {
      if (!seen.has(id)) {
        this.stopTone(id);
      }
    }
  }

  stop(): void {
    this.stopped = true;
    this.stopAll();
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
  getAnalyserNode(options: OscillatorSonifierAnalyserOptions = {}): AnalyserNode | null {
    if (!this.ctx) return null;
    const ctx = this.ctx;
    this.output ??= ctx.destination;

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

    if (this.output !== this.analyser) {
      this.output = this.analyser;
      for (const { gain } of this.nodes.values()) {
        try {
          gain.disconnect();
        } catch {
          // ignore - node may already be disconnected
        }
        gain.connect(this.output);
      }
    }

    return this.analyser;
  }

  private scale(byte: number, min: number, max: number): number {
    const clamped = Math.max(0, Math.min(255, byte));
    return min + (clamped / 255) * (max - min);
  }

  private updateTone(id: string, frequency: number, volume: number): void {
    const ctx = this.ensureContext();
    const nodes = this.nodes.get(id) ?? this.createTone(id);

    nodes.osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    nodes.gain.gain.setValueAtTime(volume, ctx.currentTime);
  }

  private createTone(id: string): ToneNodes {
    const ctx = this.ensureContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = this.oscillatorType;
    osc.connect(gain);
    gain.connect(this.output ?? ctx.destination);
    osc.start();

    const toneNodes: ToneNodes = { osc, gain };
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

    const { gain, osc } = tone;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + this.fadeMs / 1000);

    setTimeout(() => {
      osc.stop();
      osc.disconnect();
      gain.disconnect();
    }, this.fadeMs);
  }

  private stopAll(): void {
    for (const id of Array.from(this.nodes.keys())) {
      this.stopTone(id);
    }
  }

  private ensureContext(): AudioContext {
    if (!this.ctx) {
      throw new Error("OscillatorSonifier must be initialized before processing samples.");
    }
    this.output ??= this.ctx.destination;
    return this.ctx;
  }

  private pickNumber(source: Record<string, number>, keys: string[]): number | null {
    for (const key of keys) {
      const value = source[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
    }
    return null;
  }
}
