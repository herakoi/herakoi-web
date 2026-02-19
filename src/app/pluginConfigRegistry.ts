import {
  defaultMediaPipeConfig,
  type MediaPipeConfig,
  mediaPipeDetectionPluginId,
} from "#src/detection/mediapipe/config";
import {
  defaultHSVSamplingConfig,
  type HSVSamplingConfig,
  hsvSamplingPluginId,
} from "#src/sampling/hsv/config";
import {
  defaultOscillatorConfig,
  type OscillatorConfig,
  oscillatorSonificationPluginId,
} from "#src/sonification/oscillator/config";

export type AppPluginConfigRegistry = {
  [mediaPipeDetectionPluginId]: MediaPipeConfig;
  [hsvSamplingPluginId]: HSVSamplingConfig;
  [oscillatorSonificationPluginId]: OscillatorConfig;
};

export type AppActivePlugins = {
  detection: typeof mediaPipeDetectionPluginId;
  sampling: typeof hsvSamplingPluginId;
  sonification: typeof oscillatorSonificationPluginId;
  visualization: string | null;
};

export const pluginConfigDefaults: AppPluginConfigRegistry = {
  [mediaPipeDetectionPluginId]: defaultMediaPipeConfig,
  [hsvSamplingPluginId]: defaultHSVSamplingConfig,
  [oscillatorSonificationPluginId]: defaultOscillatorConfig,
};
