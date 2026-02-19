export const oscillatorSonificationPluginId = "sonification/oscillator" as const;

export interface OscillatorConfig {
  minFreq: number;
  maxFreq: number;
  minVol: number;
  maxVol: number;
  oscillatorType: OscillatorType;
}

export const defaultOscillatorConfig: OscillatorConfig = {
  minFreq: 200,
  maxFreq: 700,
  minVol: 0,
  maxVol: 0.2,
  oscillatorType: "sine",
};
