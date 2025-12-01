/**
 * Manages Web Audio tones keyed by an arbitrary id (e.g., finger or hand index).
 * We keep oscillator/gain pairs in a map so multiple fingertips can sound at once
 * and so we can cleanly stop anything we didn't update in the latest frame.
 */
export type ToneId = string;

export type ToneParams = {
  frequency: number;
  volume: number;
};

export type ToneUpdate = {
  id: ToneId;
  params: ToneParams;
};

type ToneNodes = {
  osc: OscillatorNode;
  gain: GainNode;
};

export class Sonifier {
  private readonly ctx: AudioContext;
  private readonly nodes = new Map<ToneId, ToneNodes>();
  private readonly fadeMs = 100;
  private readonly updateIntervalMs = 100;
  private readonly lastUpdate = new Map<ToneId, number>();
  private oscType: OscillatorType = "sine";

  constructor(ctx?: AudioContext) {
    if (ctx) {
      this.ctx = ctx;
      return;
    }

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

  setOscillatorType(type: OscillatorType): void {
    this.oscType = type;
    for (const { osc } of this.nodes.values()) {
      osc.type = type;
    }
  }

  updateTone(id: ToneId, params: ToneParams): void {
    const now = Date.now();
    const lastUpdateTime = this.lastUpdate.get(id) ?? 0;

    if (now - lastUpdateTime < this.updateIntervalMs) {
      return;
    }

    this.lastUpdate.set(id, now);
    const existing = this.nodes.get(id) ?? this.createTone(id);

    existing.gain.gain.setValueAtTime(params.volume, this.ctx.currentTime);
    existing.osc.frequency.setValueAtTime(params.frequency, this.ctx.currentTime);
  }

  syncTones(updates: ToneUpdate[]): void {
    const seen = new Set<ToneId>();
    for (const update of updates) {
      this.updateTone(update.id, update.params);
      seen.add(update.id);
    }

    const currentIds = Array.from(this.nodes.keys());
    for (const id of currentIds) {
      if (!seen.has(id)) {
        this.stopTone(id);
      }
    }
  }

  stopTone(id: ToneId): void {
    const tone = this.nodes.get(id);
    if (!tone) return;

    const { gain, osc } = tone;
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + this.fadeMs / 1000);

    this.lastUpdate.delete(id);

    // Use a microtask to keep tests synchronous while mirroring the fade delay for real audio.
    Promise.resolve().then(() => {
      osc.stop();
      osc.disconnect();
      gain.disconnect();
      this.nodes.delete(id);
    });
  }

  stopAll(): void {
    for (const id of Array.from(this.nodes.keys())) {
      this.stopTone(id);
    }
  }

  private createTone(id: ToneId): ToneNodes {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = this.oscType;
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();

    const toneNodes: ToneNodes = { osc, gain };
    this.nodes.set(id, toneNodes);
    return toneNodes;
  }
}
