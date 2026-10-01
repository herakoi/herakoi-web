import type { PianoScale } from "./scale";

export const pianoSamplerPluginId = "sonification/piano-sampler" as const;

export interface PianoSamplerConfig {
  noteMin: number;
  noteMax: number;
  velocityMin: number;
  velocityMax: number;
  noteDuration: string;
  scale: PianoScale;
  hysteresis: number;
  minIntervalMs: number;
}

export const defaultPianoSamplerConfig: PianoSamplerConfig = {
  noteMin: 36,
  noteMax: 83,
  velocityMin: 40,
  velocityMax: 127,
  noteDuration: "8n",
  scale: "pentatonic",
  hysteresis: 0.25,
  minIntervalMs: 100,
};
