import type {
  PluginRuntimeContext,
  PluginUISlots,
  SonificationPluginDefinition,
  SonifierHandle,
} from "#src/core/plugin";
import { defineSonificationPlugin } from "#src/core/plugin";
import { OscillatorSettingsPanel } from "./components/SettingsPanel";
import { OscillatorSonificationPanel } from "./components/SonificationPanel";
import {
  defaultOscillatorConfig,
  type OscillatorConfig,
  oscillatorSonificationPluginId,
} from "./config";
import { OscillatorSonifier } from "./OscillatorSonifier";
import { useOscillatorAudioStore } from "./store";

const ui: PluginUISlots<OscillatorConfig> = {
  SettingsPanel: OscillatorSettingsPanel,
  SonificationPanel: OscillatorSonificationPanel,
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
    const audioState = useOscillatorAudioStore.getState();
    const sonifier = new OscillatorSonifier(undefined, {
      minFreq: config.minFreq,
      maxFreq: config.maxFreq,
      minVol: config.minVol,
      maxVol: config.maxVol,
      oscillatorType: config.oscillatorType,
      masterVolume: audioState.volume,
      muted: audioState.muted,
      sinkId: audioState.sinkId,
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
    const unsubscribeAudio = useOscillatorAudioStore.subscribe((nextState, prevState) => {
      if (nextState.volume !== prevState.volume || nextState.muted !== prevState.muted) {
        sonifier.configure({
          masterVolume: nextState.volume,
          muted: nextState.muted,
        });
      }

      if (nextState.sinkId !== prevState.sinkId) {
        void sonifier.setOutputSinkId(nextState.sinkId);
      }
    });

    const dispose = () => {
      unsubscribe();
      unsubscribeAudio();
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
