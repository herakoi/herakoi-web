import { Frequency, getContext, now, Sampler, setContext, start } from "tone";
import type { ErrorOr, ImageSample, Sonifier, SonifierOptions } from "#src/core/interfaces";

const SALAMANDER_BASE_URL = "https://tonejs.github.io/audio/salamander/";

const SALAMANDER_URLS: Record<string, string> = {
  A0: "A0.mp3",
  C1: "C1.mp3",
  "D#1": "Ds1.mp3",
  "F#1": "Fs1.mp3",
  A1: "A1.mp3",
  C2: "C2.mp3",
  "D#2": "Ds2.mp3",
  "F#2": "Fs2.mp3",
  A2: "A2.mp3",
  C3: "C3.mp3",
  "D#3": "Ds3.mp3",
  "F#3": "Fs3.mp3",
  A3: "A3.mp3",
  C4: "C4.mp3",
  "D#4": "Ds4.mp3",
  "F#4": "Fs4.mp3",
  A4: "A4.mp3",
  C5: "C5.mp3",
  "D#5": "Ds5.mp3",
  "F#5": "Fs5.mp3",
  A5: "A5.mp3",
  C6: "C6.mp3",
  "D#6": "Ds6.mp3",
  "F#6": "Fs6.mp3",
  A6: "A6.mp3",
  C7: "C7.mp3",
  "D#7": "Ds7.mp3",
  "F#7": "Fs7.mp3",
  A7: "A7.mp3",
  C8: "C8.mp3",
};

export interface PianoSamplerSonifierOptions extends SonifierOptions {
  noteMin?: number;
  noteMax?: number;
  velocityMin?: number;
  velocityMax?: number;
  noteDuration?: string;
  masterVolume?: number;
  muted?: boolean;
  sinkId?: string;
}

type SinkableAudioContext = AudioContext & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

export class PianoSamplerSonifier implements Sonifier {
  private sampler: Sampler | null = null;
  private samplerReady = false;
  private initialized = false;
  private stopped = false;
  private lastNotes = new Map<string, number>();
  /** Stored so stop() can abort a pending initialize() load. */
  private loadResolver: ((aborted: boolean) => void) | null = null;
  private ownsToneContext = false;

  private noteMin = 36;
  private noteMax = 83;
  private velocityMin = 40;
  private velocityMax = 127;
  private noteDuration = "8n";
  private masterVolume = 1;
  private muted = false;
  private sinkId = "";

  constructor(options: PianoSamplerSonifierOptions = {}) {
    this.configure(options);
  }

  async initialize(): Promise<ErrorOr<undefined>> {
    if (this.initialized) return;
    if (this.stopped) return new Error("PianoSamplerSonifier was stopped before initialization");

    this.ensureSinkCapableToneContext();

    const aborted = await new Promise<boolean>((resolve) => {
      this.loadResolver = resolve;
      this.sampler = new Sampler({
        urls: SALAMANDER_URLS,
        release: 1,
        baseUrl: SALAMANDER_BASE_URL,
        onload: () => {
          this.samplerReady = true;
          this.loadResolver = null;
          resolve(false);
        },
      }).toDestination();
    });

    this.loadResolver = null;

    if (aborted) {
      return new Error("PianoSamplerSonifier was stopped during sample loading");
    }

    // Try to resume Tone's AudioContext; will succeed after user gesture
    await start().catch(() => {
      // Expected to fail until user interaction
    });

    // Register one-time interaction listeners so the context resumes after first gesture
    const resumeOnInteraction = () => {
      void start().catch(() => {});
    };
    document.addEventListener("click", resumeOnInteraction, { once: true, capture: true });
    document.addEventListener("keydown", resumeOnInteraction, { once: true, capture: true });
    document.addEventListener("touchstart", resumeOnInteraction, { once: true, capture: true });

    this.applyOutputMixState();
    if (this.sinkId) {
      await this.setOutputSinkId(this.sinkId);
    }

    this.initialized = true;
  }

  processSamples(samples: Map<string, ImageSample>): ErrorOr<undefined> {
    if (!this.sampler || !this.samplerReady) return;
    if (this.stopped) return;

    const seen = new Set<string>();

    for (const [id, sample] of samples) {
      const hueByte = this.pickNumber(sample.data, ["hueByte", "hue", "h"]);
      const valueByte = this.pickNumber(sample.data, ["valueByte", "value", "v", "brightness"]);

      if (hueByte === null || valueByte === null) continue;

      // Convert hueByte (0–255) → hue° (0–360), then apply Herakoi clip
      const hueRaw = (hueByte * 360) / 255;
      const hue = hueRaw > 300 ? 0 : hueRaw;

      // Map hue° (0–300) → MIDI note
      const midiNote = Math.max(
        this.noteMin,
        Math.min(
          this.noteMax,
          this.noteMin + Math.round((hue / 300) * (this.noteMax - this.noteMin)),
        ),
      );

      if (midiNote === this.lastNotes.get(id)) {
        seen.add(id);
        continue;
      }

      // Map valueByte (0–255) → velocity (0–1)
      const velocity =
        (this.velocityMin + (valueByte / 255) * (this.velocityMax - this.velocityMin)) / 127;

      const noteName = Frequency(midiNote, "midi").toNote();
      this.sampler.triggerAttackRelease(noteName, this.noteDuration, now(), velocity);

      this.lastNotes.set(id, midiNote);
      seen.add(id);
    }

    // Clean up IDs no longer in samples
    for (const id of this.lastNotes.keys()) {
      if (!seen.has(id)) {
        this.lastNotes.delete(id);
      }
    }
  }

  stop(): void {
    this.stopped = true;
    // Unblock any initialize() awaiting onload so it can return early.
    this.loadResolver?.(true);
    this.loadResolver = null;
    if (this.sampler) {
      this.sampler.releaseAll();
      this.sampler.dispose();
      this.sampler = null;
    }
    if (this.ownsToneContext) {
      const rawContext = this.getRawAudioContext();
      void rawContext?.close().catch(() => {});
      this.ownsToneContext = false;
    }
    this.lastNotes.clear();
  }

  configure(options: PianoSamplerSonifierOptions): void {
    if (options.noteMin !== undefined) this.noteMin = options.noteMin;
    if (options.noteMax !== undefined) this.noteMax = options.noteMax;
    if (options.velocityMin !== undefined) this.velocityMin = options.velocityMin;
    if (options.velocityMax !== undefined) this.velocityMax = options.velocityMax;
    if (options.noteDuration !== undefined) this.noteDuration = options.noteDuration;
    if (options.masterVolume !== undefined) {
      this.masterVolume = Math.max(0, Math.min(1, options.masterVolume));
    }
    if (options.muted !== undefined) this.muted = options.muted;
    if (options.sinkId !== undefined) {
      this.sinkId = options.sinkId;
      void this.setOutputSinkId(options.sinkId);
    }
    this.applyOutputMixState();
  }

  async setOutputSinkId(sinkId: string): Promise<boolean> {
    this.sinkId = sinkId;

    const rawContext = this.getRawAudioContext();
    if (typeof rawContext.setSinkId !== "function") {
      return false;
    }

    try {
      await rawContext.setSinkId(sinkId);
      return true;
    } catch {
      return false;
    }
  }

  private ensureSinkCapableToneContext(): void {
    const rawContext = this.getRawAudioContext();
    if (typeof rawContext.setSinkId === "function") return;
    if (typeof window === "undefined") return;
    if (!window.AudioContext) return;

    try {
      const nativeContext = new window.AudioContext();
      setContext(nativeContext);
      this.ownsToneContext = true;
    } catch {
      this.ownsToneContext = false;
    }
  }

  private getRawAudioContext(): SinkableAudioContext {
    return getContext().rawContext as SinkableAudioContext;
  }

  private applyOutputMixState(): void {
    if (!this.sampler) return;
    const effectiveVolume = this.muted ? 0 : this.masterVolume;
    this.sampler.volume.value = this.linearGainToDb(effectiveVolume);
  }

  private linearGainToDb(gain: number): number {
    if (gain <= 0) return -60;
    return 20 * Math.log10(gain);
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
