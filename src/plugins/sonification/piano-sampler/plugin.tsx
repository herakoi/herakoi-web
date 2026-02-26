import type {
  PluginRuntimeContext,
  PluginUISlots,
  SonificationPluginDefinition,
  SonifierHandle,
} from "#src/core/plugin";
import { defineSonificationPlugin } from "#src/core/plugin";
import { PianoSamplerSettingsPanel } from "./components/SettingsPanel";
import { defaultPianoSamplerConfig, type PianoSamplerConfig, pianoSamplerPluginId } from "./config";
import { PianoSamplerSonifier } from "./PianoSamplerSonifier";

const ui: PluginUISlots<PianoSamplerConfig> = {
  SettingsPanel: PianoSamplerSettingsPanel,
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
      const sonifier = new PianoSamplerSonifier({
        noteMin: config.noteMin,
        noteMax: config.noteMax,
        velocityMin: config.velocityMin,
        velocityMax: config.velocityMax,
        noteDuration: config.noteDuration,
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

      const dispose = () => {
        unsubscribe();
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
