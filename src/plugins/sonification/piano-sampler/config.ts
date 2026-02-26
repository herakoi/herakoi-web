export const pianoSamplerPluginId = "sonification/piano-sampler" as const;

export interface PianoSamplerConfig {
  noteMin: number;
  noteMax: number;
  velocityMin: number;
  velocityMax: number;
  noteDuration: string;
}

export const defaultPianoSamplerConfig: PianoSamplerConfig = {
  noteMin: 36,
  noteMax: 83,
  velocityMin: 40,
  velocityMax: 127,
  noteDuration: "8n",
};
