import type { PipelineConfig } from "#src/core/plugin";
import { mediaPipeDetectionPlugin } from "#src/detection/mediapipe/plugin";
import { hsvSamplingPlugin } from "#src/sampling/hsv/plugin";
import { oscillatorSonificationPlugin } from "#src/sonification/oscillator/plugin";
import { debugHudVisualizationPlugin } from "#src/visualization/debugHud/plugin";

/**
 * Pipeline composition configuration.
 *
 * Each slot contains an array of available plugins. The shell manages which
 * plugin is active per slot (persisted in appConfigStore). To add a new plugin,
 * append it to the appropriate array.
 *
 * Example: To add a mouse detector, import it and add to detection array:
 * ```
 * import { mouseDetectionPlugin } from "#src/detection/mouse/plugin";
 * detection: [mediaPipeDetectionPlugin, mouseDetectionPlugin],
 * ```
 */
// TODO: Generalizzare la discovery dei plugin per evitare una config statica
export const pipelineConfig = {
  detection: [mediaPipeDetectionPlugin],
  sampling: [hsvSamplingPlugin],
  sonification: [oscillatorSonificationPlugin],
  visualization: [debugHudVisualizationPlugin],
} as const satisfies PipelineConfig;
