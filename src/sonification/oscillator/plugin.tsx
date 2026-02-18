import { Waves } from "lucide-react";
import { useAppConfigStore } from "#src/app/state/appConfigStore";
import type {
  PluginTabMeta,
  PluginUISlots,
  SonificationPlugin,
  SonifierHandle,
} from "#src/core/plugin";
import type { OscillatorConfig } from "#src/core/pluginConfig";
import { OscillatorSettingsPanel } from "./components/SettingsPanel";
import { OscillatorSonifier } from "./OscillatorSonifier";

const settingsTab: PluginTabMeta = {
  key: "audio",
  label: "Audio",
  icon: <Waves className="h-3.5 w-3.5" />,
};

const ui: PluginUISlots<OscillatorConfig> = {
  SettingsPanel: OscillatorSettingsPanel,
};

export const oscillatorSonificationPlugin: SonificationPlugin<"oscillator"> = {
  kind: "sonification",
  id: "oscillator",
  displayName: "Web Audio Oscillator",
  settingsTab,
  ui,

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
      const config = state.pluginConfigs.oscillator;
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
