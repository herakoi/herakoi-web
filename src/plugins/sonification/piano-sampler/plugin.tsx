import type {
  PluginRuntimeContext,
  PluginUISlots,
  SonificationPluginDefinition,
  SonifierHandle,
} from "#src/core/plugin";
import { defineSonificationPlugin } from "#src/core/plugin";
import { PianoSamplerSettingsPanel } from "./components/SettingsPanel";
import { PianoSamplerSonificationPanel } from "./components/SonificationPanel";
import { defaultPianoSamplerConfig, type PianoSamplerConfig, pianoSamplerPluginId } from "./config";
import { PianoSamplerSonifier } from "./PianoSamplerSonifier";
import { usePianoSamplerAudioStore } from "./store";

const ui: PluginUISlots<PianoSamplerConfig> = {
  SettingsPanel: PianoSamplerSettingsPanel,
  SonificationPanel: PianoSamplerSonificationPanel,
};

export const plugin: SonificationPluginDefinition<typeof pianoSamplerPluginId, PianoSamplerConfig> =
  defineSonificationPlugin({
    id: pianoSamplerPluginId,
    displayName: "Piano Sampler",
    ui,
    config: {
      defaultConfig: defaultPianoSamplerConfig,
    },

    createSonifier(
      config: PianoSamplerConfig,
      runtime: PluginRuntimeContext<PianoSamplerConfig>,
    ): SonifierHandle {
      const audioState = usePianoSamplerAudioStore.getState();
      const sonifier = new PianoSamplerSonifier({
        noteMin: config.noteMin,
        noteMax: config.noteMax,
        velocityMin: config.velocityMin,
        velocityMax: config.velocityMax,
        noteDuration: config.noteDuration,
        masterVolume: audioState.volume,
        muted: audioState.muted,
        sinkId: audioState.sinkId,
      });

      const unsubscribe = runtime.subscribeConfig((config) => {
        sonifier.configure({
          noteMin: config.noteMin,
          noteMax: config.noteMax,
          velocityMin: config.velocityMin,
          velocityMax: config.velocityMax,
          noteDuration: config.noteDuration,
        });
      });
      const unsubscribeAudio = usePianoSamplerAudioStore.subscribe((nextState, prevState) => {
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
        extras: {},
        cleanup: () => dispose(),
        [Symbol.dispose]: dispose,
      };
    },
  });
