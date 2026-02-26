import type {
  PluginRuntimeContext,
  PluginUISlots,
  SonificationPluginDefinition,
  SonifierHandle,
} from "#src/core/plugin";
import { defineSonificationPlugin } from "#src/core/plugin";
import { OscillatorSettingsPanel } from "./components/SettingsPanel";
import {
  defaultOscillatorConfig,
  type OscillatorConfig,
  oscillatorSonificationPluginId,
} from "./config";
import { OscillatorSonifier } from "./OscillatorSonifier";

const ui: PluginUISlots<OscillatorConfig> = {
  SettingsPanel: OscillatorSettingsPanel,
};

export const plugin: SonificationPluginDefinition<
  typeof oscillatorSonificationPluginId,
  OscillatorConfig
> = defineSonificationPlugin({
  id: oscillatorSonificationPluginId,
  displayName: "Web Audio Oscillator",
  ui,
  config: {
    defaultConfig: defaultOscillatorConfig,
  },

  createSonifier(
    config: OscillatorConfig,
    runtime: PluginRuntimeContext<OscillatorConfig>,
  ): SonifierHandle {
    const sonifier = new OscillatorSonifier(undefined, {
      minFreq: config.minFreq,
      maxFreq: config.maxFreq,
      minVol: config.minVol,
      maxVol: config.maxVol,
      oscillatorType: config.oscillatorType,
    });

    // Subscribe to config changes from the framework
    const unsubscribe = runtime.subscribeConfig((config) => {
      sonifier.configure({
        minFreq: config.minFreq,
        maxFreq: config.maxFreq,
        minVol: config.minVol,
        maxVol: config.maxVol,
        oscillatorType: config.oscillatorType,
      });
    });
    const dispose = () => {
      unsubscribe();
      sonifier.stop();
    };

    return {
      sonifier,
      extras: {
        getAnalyser: (options?: { fftSize?: number; smoothingTimeConstant?: number }) =>
          sonifier.getAnalyserNode(options),
        getLastFrameDebug: () => sonifier.getLastFrameDebug(),
      },
      cleanup: () => dispose(),
      [Symbol.dispose]: dispose,
    };
  },
});
