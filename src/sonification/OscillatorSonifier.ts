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

import type { ImageSample, Sonifier, SonifierOptions } from "#src/core/interfaces";

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

export class OscillatorSonifier implements Sonifier {
  private ctx: AudioContext | null;
  private nodes = new Map<string, ToneNodes>();
  private oscillatorType: OscillatorType = "sine";
  private minFreq = 200;
  private maxFreq = 700;
  private minVol = 0;
  private maxVol = 0.2;
  private fadeMs = 100;
  private initialized = false;
  private stopped = false;

  constructor(ctx?: AudioContext, options: OscillatorSonifierOptions = {}) {
    this.ctx = ctx ?? null;
    this.configure(options);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.ctx) {
      const NativeAudioContext =
        typeof window !== "undefined"
          ? window.AudioContext ||
            (window as typeof window & { webkitAudioContext?: typeof AudioContext })
              .webkitAudioContext
          : undefined;

      if (!NativeAudioContext) {
        throw new Error("Web Audio API is not available in this environment.");
      }

      this.ctx = new NativeAudioContext();
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

  processSamples(samples: Map<string, ImageSample>): void {
    if (!this.ctx) {
      throw new Error("OscillatorSonifier must be initialized before processing samples.");
    }

    if (this.stopped) {
      return; // Ignore samples after stop() has been called
    }

    const seen = new Set<string>();

    for (const [id, sample] of samples) {
      const hueByte = this.pickNumber(sample.data, ["hueByte", "hue", "h"]);
      const valueByte = this.pickNumber(sample.data, ["valueByte", "value", "v", "brightness"]);

      if (hueByte === null || valueByte === null) {
        continue; // Skip samples missing required fields
      }

      const frequency = this.scale(hueByte, this.minFreq, this.maxFreq);
      const volume = this.scale(valueByte, this.minVol, this.maxVol);

      this.updateTone(id, frequency, volume);
      seen.add(id);
    }

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
    gain.connect(ctx.destination);
    osc.start();

    const toneNodes: ToneNodes = { osc, gain };
    this.nodes.set(id, toneNodes);
    return toneNodes;
  }

  private stopTone(id: string): void {
    const tone = this.nodes.get(id);
    const ctx = this.ctx;
    if (!tone || !ctx) return;

    const { gain, osc } = tone;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + this.fadeMs / 1000);

    setTimeout(() => {
      osc.stop();
      osc.disconnect();
      gain.disconnect();
      this.nodes.delete(id);
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
