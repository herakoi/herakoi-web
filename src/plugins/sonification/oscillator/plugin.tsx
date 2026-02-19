import { Waves } from "lucide-react";
import { useAppConfigStore } from "#src/app/state/appConfigStore";
import type {
  PluginTabMeta,
  PluginUISlots,
  SonificationPlugin,
  SonifierHandle,
} from "#src/core/plugin";
import { OscillatorSettingsPanel } from "./components/SettingsPanel";
import {
  defaultOscillatorConfig,
  type OscillatorConfig,
  oscillatorSonificationPluginId,
} from "./config";
import { OscillatorSonifier } from "./OscillatorSonifier";

const settingsTab: PluginTabMeta = {
  key: "audio",
  label: "Audio",
  icon: <Waves className="h-3.5 w-3.5" />,
};

const ui: PluginUISlots<OscillatorConfig> = {
  SettingsPanel: OscillatorSettingsPanel,
};

export const oscillatorSonificationPlugin: SonificationPlugin<
  typeof oscillatorSonificationPluginId,
  OscillatorConfig
> = {
  kind: "sonification",
  id: oscillatorSonificationPluginId,
  displayName: "Web Audio Oscillator",
  settingsTab,
  ui,
  config: {
    defaultConfig: defaultOscillatorConfig,
  },

  createSonifier(config: OscillatorConfig): SonifierHandle {
    const sonifier = new OscillatorSonifier(undefined, {
      minFreq: config.minFreq,
      maxFreq: config.maxFreq,
      minVol: config.minVol,
      maxVol: config.maxVol,
      oscillatorType: config.oscillatorType,
    });

    // Subscribe to config changes from the framework
    const unsubscribe = useAppConfigStore.subscribe((state) => {
      const config = state.pluginConfigs[oscillatorSonificationPluginId];
      sonifier.configure({
        minFreq: config.minFreq,
        maxFreq: config.maxFreq,
        minVol: config.minVol,
        maxVol: config.maxVol,
        oscillatorType: config.oscillatorType,
      });
    });

    return {
      sonifier,
      extras: {
        getAnalyser: (options?: { fftSize?: number; smoothingTimeConstant?: number }) =>
          sonifier.getAnalyserNode(options),
        getLastFrameDebug: () => sonifier.getLastFrameDebug(),
      },
      cleanup: () => unsubscribe(),
    };
  },
};
