import { Waves } from "lucide-react";
import { AudioPanel } from "#src/app/components/panels/AudioPanel";
import { usePipelineStore } from "#src/app/state/pipelineStore";
import type {
  PluginTabMeta,
  PluginUISlots,
  SonificationPlugin,
  SonifierHandle,
} from "#src/core/plugin";
import { OscillatorSonifier } from "./OscillatorSonifier";

const settingsTab: PluginTabMeta = {
  key: "audio",
  label: "Audio",
  icon: <Waves className="h-3.5 w-3.5" />,
};

// Stub: AudioPanel still reads from pipelineStore.oscillator.
// In a full extraction, the oscillator settings would move to this plugin's own store.
const ui: PluginUISlots = {
  SettingsPanel: AudioPanel,
};

export const oscillatorSonificationPlugin: SonificationPlugin = {
  kind: "sonification",
  id: "oscillator",
  displayName: "Web Audio Oscillator",
  settingsTab,
  ui,

  createSonifier(): SonifierHandle {
    const state = usePipelineStore.getState();
    const sonifier = new OscillatorSonifier(undefined, {
      minFreq: state.oscillator.minFreq,
      maxFreq: state.oscillator.maxFreq,
      minVol: state.oscillator.minVol,
      maxVol: state.oscillator.maxVol,
      oscillatorType: state.oscillator.oscillatorType,
    });

    return {
      sonifier,
      extras: {
        // Expose analyser for visualizations (like ReactiveMark)
        getAnalyser: (options?: { fftSize?: number; smoothingTimeConstant?: number }) =>
          sonifier.getAnalyserNode(options),
      },
    };
  },
};
