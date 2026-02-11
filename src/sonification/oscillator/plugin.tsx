import { Waves } from "lucide-react";
import type {
  PluginTabMeta,
  PluginUISlots,
  SonificationPlugin,
  SonifierHandle,
} from "#src/core/plugin";
import { OscillatorSettingsPanel } from "./components/SettingsPanel";
import { OscillatorSonifier } from "./OscillatorSonifier";
import { useOscillatorSonificationStore } from "./store";

const settingsTab: PluginTabMeta = {
  key: "audio",
  label: "Audio",
  icon: <Waves className="h-3.5 w-3.5" />,
};

const ui: PluginUISlots = {
  SettingsPanel: OscillatorSettingsPanel,
};

export const oscillatorSonificationPlugin: SonificationPlugin = {
  kind: "sonification",
  id: "oscillator",
  displayName: "Web Audio Oscillator",
  settingsTab,
  ui,

  createSonifier(): SonifierHandle {
    const state = useOscillatorSonificationStore.getState();
    const sonifier = new OscillatorSonifier(undefined, {
      minFreq: state.minFreq,
      maxFreq: state.maxFreq,
      minVol: state.minVol,
      maxVol: state.maxVol,
      oscillatorType: state.oscillatorType,
    });

    const unsubscribe = useOscillatorSonificationStore.subscribe((next) => {
      sonifier.configure({
        minFreq: next.minFreq,
        maxFreq: next.maxFreq,
        minVol: next.minVol,
        maxVol: next.maxVol,
        oscillatorType: next.oscillatorType,
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
