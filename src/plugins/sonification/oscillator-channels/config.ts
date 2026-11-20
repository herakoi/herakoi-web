import type { RestBehavior } from "#src/plugins/sonification/shared/motion";
import type { SoundMode } from "#src/plugins/sonification/shared/motionGate";
import type { VoiceEffectKind } from "#src/plugins/sonification/shared/voiceEffects";
import type { NoDataBehavior } from "./ChannelOscillatorSonifier";

export const channelOscillatorPluginId = "sonification/oscillator-channels" as const;

/** Effect types a slot can use ("none" is not a slot). */
export type EffectSlotKind = Exclude<VoiceEffectKind, "none">;

/** One effect: the channel driving it, its type and strength. */
export interface EffectSlotConfig {
  /** Stable key for the settings list. */
  id: string;
  /** null: no channel chosen yet (the slot is inactive). */
  channel: string | null;
  invert: boolean;
  noData: NoDataBehavior;
  kind: EffectSlotKind;
  /** Strength, 0–1. */
  amount: number;
}

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
  /** Effects, applied in this order; each type at most once. */
  effects: EffectSlotConfig[];
  /** Distance (fraction of the image's longer side) at which "pulse faster near data" starts. */
  proximityReach: number;
  oscillatorType: OscillatorType;
  /** How hand motion shapes the sound: only while moving (default), plucked, or continuous. */
  soundMode: SoundMode;
  /** What to play when the hand rests in one spot (motion-driven modes). */
  restBehavior: RestBehavior;
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
  effects: [],
  proximityReach: 0.15,
  oscillatorType: "sine",
  soundMode: "moving",
  restBehavior: "once",
};

/** Fields of the single effect that configs saved before effect slots still carry. */
type LegacyEffectFields = {
  effectChannel?: string | null;
  effectInvert?: boolean;
  effectNoData?: NoDataBehavior;
  effectKind?: VoiceEffectKind;
  effectAmount?: number;
};

/**
 * The config's effects. A config saved with the earlier single effect (and no slots yet)
 * becomes one slot, so the choice is kept.
 */
export const effectSlotsOf = (config: ChannelOscillatorConfig): EffectSlotConfig[] => {
  if (config.effects?.length) return config.effects;
  const legacy = config as ChannelOscillatorConfig & LegacyEffectFields;
  if (!legacy.effectChannel || !legacy.effectKind || legacy.effectKind === "none") return [];
  return [
    {
      id: "effect-1",
      channel: legacy.effectChannel,
      invert: legacy.effectInvert ?? false,
      noData: legacy.effectNoData ?? "pulse",
      kind: legacy.effectKind,
      amount: legacy.effectAmount ?? 0.7,
    },
  ];
};
