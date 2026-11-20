import type { SoundMode } from "#src/plugins/sonification/shared/motionGate";
import type { VoiceEffectKind } from "#src/plugins/sonification/shared/voiceEffects";
import type { NoDataBehavior } from "./ChannelOscillatorSonifier";

export const channelOscillatorPluginId = "sonification/oscillator-channels" as const;

/**
 * Which sample channel drives each sound property. Channel keys come from the active
 * sampler (e.g. "hueByte", "layer.3"). The defaults reproduce the classic oscillator.
 */
export interface ChannelOscillatorConfig {
  pitchChannel: string;
  pitchInvert: boolean;
  /** Where the pitch channel has no data. */
  pitchNoData: NoDataBehavior;
  minFreq: number;
  maxFreq: number;
  volumeChannel: string;
  volumeInvert: boolean;
  volumeNoData: NoDataBehavior;
  minVol: number;
  maxVol: number;
  /** null: no effect channel. */
  effectChannel: string | null;
  effectInvert: boolean;
  effectNoData: NoDataBehavior;
  effectKind: VoiceEffectKind;
  /** Effect strength, 0–1. */
  effectAmount: number;
  /** Distance (fraction of the image's longer side) at which "pulse faster near data" starts. */
  proximityReach: number;
  oscillatorType: OscillatorType;
  /** How hand motion shapes the sound: only while moving (default), plucked, or continuous. */
  soundMode: SoundMode;
}

export const defaultChannelOscillatorConfig: ChannelOscillatorConfig = {
  pitchChannel: "hueByte",
  pitchInvert: false,
  pitchNoData: "silence",
  minFreq: 200,
  maxFreq: 700,
  volumeChannel: "valueByte",
  volumeInvert: false,
  volumeNoData: "silence",
  minVol: 0,
  maxVol: 0.2,
  effectChannel: null,
  effectInvert: false,
  effectNoData: "pulse",
  effectKind: "chorus",
  effectAmount: 0.7,
  proximityReach: 0.15,
  oscillatorType: "sine",
  soundMode: "moving",
};
