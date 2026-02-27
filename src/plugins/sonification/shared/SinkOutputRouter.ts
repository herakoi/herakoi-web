export type SinkableAudioContext = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

type SinkOutputRouterOptions = {
  fadeOutMs?: number;
  fadeInMs?: number;
  timeoutMs?: number;
  minGain?: number;
  settleMs?: number;
};

const DEFAULT_TIMEOUT_MS = 1500;
const DEFAULT_FADE_OUT_MS = 25;
const DEFAULT_FADE_IN_MS = 35;
const DEFAULT_MIN_GAIN = 0.0001;
const DEFAULT_SETTLE_MS = 0;

export class SinkOutputRouter {
  private readonly inputGain: GainNode;
  private readonly switchGain: GainNode;
  private outputNode: AudioNode;
  private currentSinkId = "";
  private readonly fadeOutMs: number;
  private readonly fadeInMs: number;
  private readonly timeoutMs: number;
  private readonly minGain: number;
  private readonly settleMs: number;
  private switchSequence = 0;
  private sinkSwitchQueue: Promise<boolean> = Promise.resolve(true);

  constructor(
    private readonly ctx: SinkableAudioContext,
    options: SinkOutputRouterOptions = {},
  ) {
    this.fadeOutMs = options.fadeOutMs ?? DEFAULT_FADE_OUT_MS;
    this.fadeInMs = options.fadeInMs ?? DEFAULT_FADE_IN_MS;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.minGain = Math.max(0, options.minGain ?? DEFAULT_MIN_GAIN);
    this.settleMs = Math.max(0, options.settleMs ?? DEFAULT_SETTLE_MS);

    this.inputGain = ctx.createGain();
    this.switchGain = ctx.createGain();

    this.outputNode = ctx.destination;
    this.inputGain.connect(this.switchGain);
    this.switchGain.connect(this.outputNode);
    this.switchGain.gain.setValueAtTime(1, ctx.currentTime);
  }

  getContext(): SinkableAudioContext {
    return this.ctx;
  }

  getInputNode(): GainNode {
    return this.inputGain;
  }

  getCurrentSinkId(): string {
    return this.currentSinkId;
  }

  setOutputNode(node: AudioNode): void {
    if (this.outputNode === node) return;

    try {
      this.switchGain.disconnect(this.outputNode);
    } catch {
      // ignore - already disconnected
    }

    this.outputNode = node;
    this.switchGain.connect(this.outputNode);
  }

  async setSinkId(sinkId: string): Promise<boolean> {
    this.sinkSwitchQueue = this.sinkSwitchQueue
      .catch(() => false)
      .then(() => this.setSinkIdInternal(sinkId));
    return this.sinkSwitchQueue;
  }

  private async setSinkIdInternal(sinkId: string): Promise<boolean> {
    if (typeof this.ctx.setSinkId !== "function") {
      return false;
    }
    if (sinkId === this.currentSinkId) {
      return true;
    }

    const sequence = ++this.switchSequence;
    await this.rampSwitchGain(this.minGain, this.fadeOutMs);

    let changed = false;
    try {
      await this.withTimeout(this.ctx.setSinkId(sinkId));
      this.currentSinkId = sinkId;
      changed = true;
      return true;
    } catch {
      if (!sinkId) {
        return false;
      }

      try {
        await this.withTimeout(this.ctx.setSinkId(""));
        this.currentSinkId = "";
        changed = true;
        return true;
      } catch {
        return false;
      }
    } finally {
      if (this.settleMs > 0) {
        await this.sleep(this.settleMs);
      }
      if (sequence === this.switchSequence || changed) {
        await this.rampSwitchGain(1, this.fadeInMs);
      } else {
        this.setSwitchGainImmediately(1);
      }
    }
  }

  dispose(): void {
    try {
      this.inputGain.disconnect();
    } catch {
      // ignore
    }

    try {
      this.switchGain.disconnect();
    } catch {
      // ignore
    }
  }

  private async rampSwitchGain(target: number, durationMs: number): Promise<void> {
    const now = this.ctx.currentTime;
    const gain = this.switchGain.gain;
    const next = Math.max(0, this.minGain, target);
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);

    if (durationMs <= 0) {
      gain.setValueAtTime(next, now);
      return;
    }

    gain.linearRampToValueAtTime(next, now + durationMs / 1000);
    await new Promise<void>((resolve) => {
      setTimeout(resolve, durationMs);
    });
  }

  private setSwitchGainImmediately(value: number): void {
    const now = this.ctx.currentTime;
    const gain = this.switchGain.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(Math.max(0, this.minGain, value), now);
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("setSinkId timed out"));
      }, this.timeoutMs);

      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
