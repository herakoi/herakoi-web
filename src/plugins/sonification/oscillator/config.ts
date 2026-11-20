import type { RestBehavior } from "#src/plugins/sonification/shared/motion";
import type { SoundMode } from "#src/plugins/sonification/shared/motionGate";

export const oscillatorSonificationPluginId = "sonification/oscillator" as const;

export interface OscillatorConfig {
  minFreq: number;
  maxFreq: number;
  minVol: number;
  maxVol: number;
  oscillatorType: OscillatorType;
  /** How hand motion shapes the sound: only while moving (default), plucked, or continuous. */
  soundMode: SoundMode;
  /** What to play when the hand rests in one spot (motion-driven modes). */
  restBehavior: RestBehavior;
}

export const defaultOscillatorConfig: OscillatorConfig = {
  minFreq: 200,
  maxFreq: 700,
  minVol: 0,
  maxVol: 0.2,
  oscillatorType: "sine",
  soundMode: "moving",
  restBehavior: "once",
};
